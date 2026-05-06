from langchain_pinecone import PineconeVectorStore
from src.embed import get_embeddings
from src.utils import PINECONE_INDEX_NAME

def store_documents(chunks):
    embeddings = get_embeddings()

    print(f"📊 Total chunks: {len(chunks)}")

    batch_size = 100  # 🔥 IMPORTANT

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]

        print(f"⬆️ Uploading batch {i//batch_size + 1}...")

        PineconeVectorStore.from_documents(
            documents=batch,
            embedding=embeddings,
            index_name=PINECONE_INDEX_NAME
        )

    print("✅ All batches uploaded!")