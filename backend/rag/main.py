from src.ingest import load_documents
from src.embed import split_documents
from src.store import store_documents
from src.query import ask_question

def ingest_pipeline():
    print("📥 Loading documents...")
    docs = load_documents()

    print("✂️ Splitting documents...")
    chunks = split_documents(docs)

    print("📦 Storing embeddings...")
    store_documents(chunks)

    print("✅ Ingestion complete!")

def query_loop():
    while True:
        query = input("\n💬 Ask fitness question (type 'exit'): ")
        if query.lower() == "exit":
            break

        answer = ask_question(query)
        print("\n🤖 Answer:", answer)

if __name__ == "__main__":
    print("1 → Ingest Data")
    print("2 → Ask Questions")

    choice = input("Choose: ")

    if choice == "1":
        ingest_pipeline()
    elif choice == "2":
        query_loop()