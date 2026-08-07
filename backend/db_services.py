import os
import io
import PyPDF2
from supabase import create_client, Client
from google import genai
from google.genai import types

# Delete the SentenceTransformer model line entirely!

def get_embedding(text: str):
    """Generates embeddings using Gemini's free API instead of a local model"""
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    
    response = client.models.embed_content(
        model="gemini-embedding-001",  # <-- Make sure it says gemini-embedding-001 here
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=384) 
    )
    
    return response.embeddings[0].values

def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    return create_client(url, key)


def process_pdf(file_bytes):
    """Extracts text from PDF bytes and splits it into manageable chunks."""
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    
    chunk_size = 1000
    chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
    return chunks

def process_raw_text(file_bytes):
    """Extracts text from raw bytes and splits it into manageable chunks."""
    text = file_bytes.decode('utf-8', errors='ignore')
    chunk_size = 1000
    chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
    return chunks

def upload_to_supabase_storage(user_email, subject_name, filename, file_bytes):
    """Uploads the raw file to Supabase Storage."""
    supabase = get_supabase()
    folder_path = f"{user_email}/{subject_name}/{filename}"
    try:
        supabase.storage.from_("veda_pdfs").upload(
            file=file_bytes,
            path=folder_path,
            file_options={"content-type": "application/octet-stream"}
        )
    except Exception as e:
        print(f"Storage upload note (file might already exist): {e}")

def delete_workspace(subject_name, user_email):
    """Wipes the workspace completely from Supabase (Vectors, Storage, and History)."""
    supabase = get_supabase()
    try:
        supabase.table("veda_documents").delete().eq("user_email", user_email).eq("subject", subject_name).execute()
    except Exception as e:
        print(f"Error deleting vector records: {e}")

    if supabase:
        try:
            supabase.table("chat_history").delete().eq("email", user_email).eq("subject", subject_name).execute()
        except Exception as e:
            print(f"Error deleting chat history: {e}")

        try:
            folder_path = f"{user_email}/{subject_name}"
            files_res = supabase.storage.from_("veda_pdfs").list(folder_path)
            if files_res:
                file_paths = [f"{folder_path}/{file['name']}" for file in files_res]
                supabase.storage.from_("veda_pdfs").remove(file_paths)
        except Exception as e:
            print(f"Error deleting storage files: {e}")

def replace_chat_history(user_email, subject, messages):
    """Used for the 'Edit Message' time-machine feature."""
    supabase = get_supabase()
    if supabase:
        try:
            supabase.table("chat_history").delete().eq("email", user_email).eq("subject", subject).execute()
            if messages:
                records = [
                    {"email": user_email, "subject": subject, "role": m["role"], "content": m["content"]} 
                    for m in messages
                ]
                supabase.table("chat_history").insert(records).execute()
        except Exception as e:
            print(f"Error replacing chat history: {e}")

# -------------------------------------------------------------------
# 💥 NEWLY RESTORED FUNCTIONS NEEDED BY MAIN.PY
# -------------------------------------------------------------------

def get_inventory(user_email: str):
    """Fetches unique workspaces/subjects for the sidebar."""
    supabase = get_supabase()
    response = supabase.table("veda_documents").select("subject, source").eq("user_email", user_email).execute()
    
    inventory = {}
    for row in response.data:
        subj = row['subject']
        src = row['source']
        if subj not in inventory:
            inventory[subj] = set()
        inventory[subj].add(src)
        
    # Convert sets back to lists for JSON serialization
    return {k: list(v) for k, v in inventory.items()}

def load_chat_history(user_email: str, subject: str):
    """Fetches chat history from Supabase."""
    supabase = get_supabase()
    # Changed "user_email" to "email" to match your database schema
    response = supabase.table("chat_history").select("*").eq("email", user_email).eq("subject", subject).order("created_at").execute()
    return response.data

def save_chat_message(user_email, subject, role, content):
    """Saves a single message turn to Supabase."""
    supabase = get_supabase()
    try:
        supabase.table("chat_history").insert({
            "email": user_email,
            "subject": subject,
            "role": role,
            "content": content
        }).execute()
    except Exception as e:
        print(f"Error saving chat message: {e}")

def get_subject_text(subject, user_email):
    """Retrieves all text for a subject (used for Quiz/Study Guide generation)."""
    supabase = get_supabase()
    try:
        response = supabase.table("veda_documents").select("content").eq("user_email", user_email).eq("subject", subject).execute()
        text = ""
        if response.data:
            for row in response.data:
                text += row['content'] + "\n"
        return text
    except Exception as e:
        print(f"Error getting subject text: {e}")
        return ""
def delete_file(user_email, subject_name, filename):
    """Deletes a specific file's vectors and removes it from Supabase storage."""
    supabase = get_supabase()
    
    # 1. Delete only the vectors associated with this specific file
    try:
        supabase.table("veda_documents").delete().eq("user_email", user_email).eq("subject", subject_name).eq("source", filename).execute()
    except Exception as e:
        print(f"Error deleting file vectors: {e}")

    # 2. Delete the actual file from the Supabase storage bucket
    if supabase:
        try:
            file_path = f"{user_email}/{subject_name}/{filename}"
            supabase.storage.from_("veda_pdfs").remove([file_path])
        except Exception as e:
            print(f"Error deleting storage file: {e}")