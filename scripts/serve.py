import os
import sqlite3
import json
import smtplib
import imaplib
import asyncio
import time
import uuid
import email
from email.message import EmailMessage
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import urllib.request
import urllib.error

app = FastAPI(title="ProfScout API")

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = PROJECT_ROOT / "public"
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "user_data.db"

# Ensure data dir exists
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Database Initialization
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        api_key TEXT,
        user_name TEXT,
        user_background TEXT,
        smtp_email TEXT,
        smtp_password TEXT
    )
    ''')
    
    # In case the table was created previously without SMTP columns
    cursor.execute("PRAGMA table_info(settings)")
    columns = [col[1] for col in cursor.fetchall()]
    if "smtp_email" not in columns:
        cursor.execute("ALTER TABLE settings ADD COLUMN smtp_email TEXT DEFAULT ''")
    if "smtp_password" not in columns:
        cursor.execute("ALTER TABLE settings ADD COLUMN smtp_password TEXT DEFAULT ''")
    if "llm_provider" not in columns:
        cursor.execute("ALTER TABLE settings ADD COLUMN llm_provider TEXT DEFAULT 'openai'")
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT,
        subject TEXT,
        body TEXT
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        prof_data TEXT,
        status TEXT,
        added_at INTEGER
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        to_email TEXT,
        prof_name TEXT,
        subject TEXT,
        body TEXT,
        send_at INTEGER,
        status TEXT,
        error_msg TEXT
    )
    ''')
    
    # In case the table was created previously without prof_name
    cursor.execute("PRAGMA table_info(outbox)")
    outbox_columns = [col[1] for col in cursor.fetchall()]
    if "prof_name" not in outbox_columns:
        cursor.execute("ALTER TABLE outbox ADD COLUMN prof_name TEXT DEFAULT ''")
    
    # Insert default settings if not exists
    cursor.execute('INSERT OR IGNORE INTO settings (id, api_key, user_name, user_background, smtp_email, smtp_password, llm_provider) VALUES (1, "", "", "", "", "", "openai")')
    
    # Insert default template if not exists
    cursor.execute('SELECT COUNT(*) FROM templates')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
        INSERT INTO templates (id, name, subject, body) 
        VALUES (?, ?, ?, ?)
        ''', ('1', 'Standard Cold Email', 'Prospective PhD Student - {{my_name}}', 
              'Dear Prof. {{prof_lastName}},\n\nI am a prospective PhD student interested in your work at {{univ_name}}, specifically in {{research_area}}.\n\nI recently read your paper on [insert paper here] and was fascinated by the approach. I would love to discuss potential opportunities in your lab.\n\nBest regards,\n{{my_name}}'))
        
    conn.commit()
    conn.close()

# --- Background Email Scheduler ---
async def process_outbox():
    while True:
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Find emails that are pending and due to be sent (send_at is in ms)
            current_time_ms = int(time.time() * 1000)
            cursor.execute('SELECT * FROM outbox WHERE status = "pending" AND send_at <= ?', (current_time_ms,))
            emails = cursor.fetchall()
            
            if emails:
                # Fetch settings for SMTP
                cursor.execute('SELECT smtp_email, smtp_password, user_name FROM settings WHERE id = 1')
                settings = cursor.fetchone()
                
                if settings and settings["smtp_email"] and settings["smtp_password"]:
                    sender_email = settings["smtp_email"]
                    sender_password = settings["smtp_password"]
                    sender_name = settings["user_name"] or sender_email
                    
                    try:
                        # Connect once for batch sending
                        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
                        server.login(sender_email, sender_password)
                        
                        successful_emails = []
                        for email_row in emails:
                            msg = EmailMessage()
                            msg.set_content(email_row["body"])
                            msg['Subject'] = email_row["subject"]
                            msg['From'] = f"{sender_name} <{sender_email}>"
                            msg['To'] = email_row["to_email"]
                            msg['Message-ID'] = f"<{email_row['id']}@profscout.local>"
                            
                            try:
                                server.send_message(msg)
                                cursor.execute('UPDATE outbox SET status = "sent", error_msg = "" WHERE id = ?', (email_row["id"],))
                                successful_emails.append(msg)
                            except Exception as e:
                                print(f"Failed to send scheduled email {email_row['id']}: {e}")
                                cursor.execute('UPDATE outbox SET status = "failed", error_msg = ? WHERE id = ?', (str(e), email_row["id"]))
                                
                        server.quit()
                        conn.commit()
                        
                        # IMAP Sync for sent emails
                        if successful_emails:
                            try:
                                imap = imaplib.IMAP4_SSL('imap.gmail.com')
                                imap.login(sender_email, sender_password)
                                try:
                                    imap.create('"ProfScout Sent"')
                                except:
                                    pass
                                
                                # Append to Sent
                                for msg in successful_emails:
                                    msg_bytes = bytes(msg).replace(b'\n', b'\r\n')
                                    imap.append('"ProfScout Sent"', '', imaplib.Time2Internaldate(time.time()), msg_bytes)
                                
                                # Delete from Scheduled
                                try:
                                    imap.select('"ProfScout Scheduled"')
                                    for msg in successful_emails:
                                        msg_id = msg['Message-ID']
                                        typ, data = imap.search(None, f'HEADER Message-ID "{msg_id}"')
                                        for num in data[0].split():
                                            imap.store(num, '+FLAGS', '\\Deleted')
                                    imap.expunge()
                                except:
                                    pass
                                imap.logout()
                            except Exception as e:
                                print(f"IMAP background sync error: {e}")
                    except Exception as e:
                        print(f"SMTP Login failed for background worker: {e}")
            conn.close()
        except Exception as e:
            print(f"Error in process_outbox loop: {e}")
            
        await asyncio.sleep(60) # check every minute

@app.on_event("startup")
def startup_event():
    init_db()
    asyncio.create_task(process_outbox())

# --- API Endpoints ---

@app.get("/api/state")
def get_state():
    """Get all user state."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Settings
    cursor.execute('SELECT * FROM settings WHERE id = 1')
    settings_row = cursor.fetchone()
    settings = {
        "apiKey": settings_row["api_key"] if settings_row else "",
        "llmProvider": settings_row["llm_provider"] if settings_row and "llm_provider" in settings_row.keys() else "openai",
        "userName": settings_row["user_name"] if settings_row else "",
        "userBackground": settings_row["user_background"] if settings_row else "",
        "smtpEmail": settings_row["smtp_email"] if settings_row else "",
        "smtpPassword": settings_row["smtp_password"] if settings_row else ""
    }
    
    # Templates
    cursor.execute('SELECT * FROM templates')
    templates = []
    for row in cursor.fetchall():
        templates.append({
            "id": row["id"],
            "name": row["name"],
            "subject": row["subject"],
            "body": row["body"]
        })
        
    # Applications
    cursor.execute('SELECT * FROM applications')
    applications = {}
    for row in cursor.fetchall():
        applications[row["id"]] = {
            "id": row["id"],
            "prof": json.loads(row["prof_data"]),
            "status": row["status"],
            "addedAt": row["added_at"]
        }
        
    conn.close()
    
    return {
        "settings": settings,
        "templates": templates,
        "applications": applications
    }

@app.post("/api/settings")
async def update_settings(request: Request):
    """Update settings."""
    data = await request.json()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
    UPDATE settings 
    SET api_key = ?, llm_provider = ?, user_name = ?, user_background = ?, smtp_email = ?, smtp_password = ?
    WHERE id = 1
    ''', (data.get("apiKey", ""), data.get("llmProvider", "openai"), data.get("userName", ""), data.get("userBackground", ""), data.get("smtpEmail", ""), data.get("smtpPassword", "")))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/test-llm")
async def test_llm(request: Request):
    """Test LLM API Key."""
    data = await request.json()
    provider = data.get("llmProvider")
    api_key = data.get("apiKey")
    if not api_key:
        raise HTTPException(status_code=400, detail="API Key is missing.")
    
    if provider == "openai":
        req = urllib.request.Request(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {api_key}"}
        )
    elif provider == "anthropic":
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=b'{"model":"claude-3-haiku-20240307","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}',
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        )
    elif provider == "gemini":
        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported Provider.")

    try:
        urllib.request.urlopen(req, timeout=5)
        return {"status": "success", "message": f"Successfully verified {provider.capitalize()} API key!"}
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"API Key verification failed: HTTP {e.code} {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Network error: {str(e)}")

@app.post("/api/test-smtp")
async def test_smtp(request: Request):
    """Test SMTP Login Credentials."""
    data = await request.json()
    smtp_email = data.get("smtpEmail")
    smtp_password = data.get("smtpPassword")
    if not smtp_email or not smtp_password:
        raise HTTPException(status_code=400, detail="Email or App Password missing.")
    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(smtp_email, smtp_password)
        server.quit()
        return {"status": "success", "message": "Successfully connected and logged into Gmail SMTP!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SMTP Login Failed: {str(e)}")

@app.post("/api/templates")
async def update_templates(request: Request):
    """Replace all templates."""
    templates = await request.json()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM templates')
    for t in templates:
        cursor.execute('''
        INSERT INTO templates (id, name, subject, body) 
        VALUES (?, ?, ?, ?)
        ''', (t["id"], t["name"], t["subject"], t["body"]))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/applications")
async def update_applications(request: Request):
    """Replace all tracked applications."""
    applications = await request.json()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM applications')
    for app_id, app_data in applications.items():
        cursor.execute('''
        INSERT INTO applications (id, prof_data, status, added_at) 
        VALUES (?, ?, ?, ?)
        ''', (app_id, json.dumps(app_data["prof"]), app_data["status"], app_data.get("addedAt", 0)))
    conn.commit()
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/send-email")
async def send_email(request: Request):
    """Send an email using configured SMTP settings, or schedule it for later (with IMAP Draft sync)."""
    data = await request.json()
    to_email = data.get("to")
    prof_name = data.get("profName", "")
    subject = data.get("subject")
    body = data.get("body")
    send_at = data.get("sendAt") # UNIX timestamp in ms
    
    if not to_email or not subject or not body:
        raise HTTPException(status_code=400, detail="Missing to, subject, or body")
        
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT smtp_email, smtp_password, user_name FROM settings WHERE id = 1')
    settings = cursor.fetchone()
    
    if not settings or not settings["smtp_email"] or not settings["smtp_password"]:
        conn.close()
        raise HTTPException(status_code=400, detail="SMTP email or password not configured in Settings")
        
    sender_email = settings["smtp_email"]
    sender_password = settings["smtp_password"]
    sender_name = settings["user_name"] or sender_email
    
    msg = EmailMessage()
    msg.set_content(body)
    msg['Subject'] = subject
    msg['From'] = f"{sender_name} <{sender_email}>"
    msg['To'] = to_email
    
    email_id = str(uuid.uuid4())
    msg['Message-ID'] = f"<{email_id}@profscout.local>"
    
    # If scheduled for future
    if send_at and int(send_at) > int(time.time() * 1000):
        cursor.execute('''
        INSERT INTO outbox (id, to_email, prof_name, subject, body, send_at, status, error_msg)
        VALUES (?, ?, ?, ?, ?, ?, "pending", "")
        ''', (email_id, to_email, prof_name, subject, body, int(send_at)))
        conn.commit()
        conn.close()
        
        # Sync to Gmail Custom Label via IMAP
        try:
            imap_server = imaplib.IMAP4_SSL('imap.gmail.com')
            imap_server.login(sender_email, sender_password)
            try:
                imap_server.create('"ProfScout Scheduled"')
            except:
                pass # Usually fails if it already exists
                
            # Encode message with \r\n for IMAP
            msg_bytes = bytes(msg).replace(b'\n', b'\r\n')
            imap_server.append('"ProfScout Scheduled"', '', imaplib.Time2Internaldate(time.time()), msg_bytes)
            imap_server.logout()
        except Exception as e:
            print(f"IMAP Sync Error: {e}")
            # We don't fail the schedule if sync fails
            
        return {"status": "scheduled", "id": email_id}
        
    conn.close()
    
    # Send immediately
    
    try:
        # Connect to Gmail SMTP server using SSL
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()
        return {"status": "success"}
    except Exception as e:
        print(f"SMTP Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/outbox")
def get_outbox():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM outbox ORDER BY send_at DESC')
    emails = []
    for row in cursor.fetchall():
        emails.append({
            "id": row["id"],
            "to": row["to_email"],
            "profName": row["prof_name"] if "prof_name" in row.keys() else "",
            "subject": row["subject"],
            "body": row["body"],
            "sendAt": row["send_at"],
            "status": row["status"],
            "errorMsg": row["error_msg"]
        })
    conn.close()
    return {"outbox": emails}

@app.delete("/api/outbox/{email_id}")
def delete_outbox(email_id: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM outbox WHERE id = ?', (email_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/sync-imap")
async def sync_imap():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM settings WHERE id = 1')
    settings = cursor.fetchone()
    
    if not settings or not settings["smtp_email"] or not settings["smtp_password"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Gmail not configured.")
        
    cursor.execute('SELECT id FROM outbox WHERE status = "pending"')
    pending_emails = cursor.fetchall()
    
    if not pending_emails:
        conn.close()
        return {"status": "success", "message": "No pending emails to sync."}
        
    try:
        imap = imaplib.IMAP4_SSL('imap.gmail.com')
        imap.login(settings["smtp_email"], settings["smtp_password"])
        
        try:
            typ, _ = imap.select('"ProfScout Scheduled"')
            if typ != 'OK':
                raise Exception("Folder not found")
                
            synced_count = 0
            for row in pending_emails:
                msg_id = f"<{row['id']}@profscout.local>"
                typ, data = imap.search(None, f'HEADER Message-ID "{msg_id}"')
                if typ == 'OK' and not data[0]:
                    cursor.execute('UPDATE outbox SET status = "failed", error_msg = "Deleted from Gmail" WHERE id = ?', (row["id"],))
                    synced_count += 1
            
            conn.commit()
        except Exception as e:
            # If folder doesn't exist, all pending are gone
            cursor.execute('UPDATE outbox SET status = "failed", error_msg = "Deleted from Gmail"')
            conn.commit()
            synced_count = len(pending_emails)
            
        imap.logout()
        conn.close()
        return {"status": "success", "message": f"Synced {synced_count} missing emails from Gmail."}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"IMAP Sync failed: {e}")

@app.get("/api/openalex/search")
def search_openalex(q: str):
    import urllib.parse
    import urllib.request
    
    # URL encode the query
    encoded_q = urllib.parse.quote(q)
    # Search authors, sort by citations, limit to 25
    url = f"https://api.openalex.org/authors?search={encoded_q}&sort=cited_by_count:desc&per-page=25"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'mailto:profscout@example.com'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            results = []
            for author in data.get('results', []):
                name = author.get('display_name', '')
                inst = author.get('last_known_institution')
                inst_name = inst.get('display_name') if inst else "Unknown Institution"
                
                # Top concepts
                concepts = author.get('x_concepts', [])
                areas_dict = {}
                for c in concepts[:3]:
                    areas_dict[c['display_name']] = int(c['score'] * 100)
                
                prof_obj = {
                    "n": name,
                    "a": inst_name,
                    "h": author.get('id', ''), # use OpenAlex ID as homepage link to their profile
                    "p": author.get('works_count', 0),
                    "c": author.get('cited_by_count', 0),
                    "ar": areas_dict
                }
                results.append(prof_obj)
            return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Static Files Serving ---

# API should be defined before static files!
app.mount("/data", StaticFiles(directory=PUBLIC_DIR / "data"), name="data")
app.mount("/src", StaticFiles(directory=PUBLIC_DIR / "src"), name="src")

@app.get("/")
def serve_index():
    return FileResponse(PUBLIC_DIR / "index.html")

def main():
    print("ProfScout API server running at http://localhost:8080")
    print(f"Serving static files from: {PUBLIC_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=8080)

if __name__ == '__main__':
    main()
