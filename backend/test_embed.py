import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

def get_embedding(text: str):
    """Generates embeddings using Gemini's free API"""
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    
    # Update the model name here
    response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=384) 
    )
    return response.embeddings[0].values

if __name__ == "__main__":
    try:
        print("Connecting to Gemini...")
        vector = get_embedding("Hello, Veda! This is a local test to make sure embeddings work.")
        
        print("\n✅ SUCCESS!")
        print(f"Vector Length: {len(vector)} dimensions (Should be 384)")
        print(f"First 3 numbers: {vector[:3]}")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")