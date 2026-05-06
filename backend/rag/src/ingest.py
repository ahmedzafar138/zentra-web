from langchain_community.document_loaders import PyPDFLoader, TextLoader
import os

def load_documents():
    documents = []

    # PDFs
    pdf_dir = "data/pdfs"
    if os.path.exists(pdf_dir):
        for file in os.listdir(pdf_dir):
            if file.endswith(".pdf"):
                loader = PyPDFLoader(os.path.join(pdf_dir, file))
                documents.extend(loader.load())

    # TXTs (FIXED)
    txt_dir = "data/txt"
    if os.path.exists(txt_dir):
        for file in os.listdir(txt_dir):
            if file.endswith(".txt"):
                loader = TextLoader(
                    os.path.join(txt_dir, file),
                    encoding="utf-8",
                    autodetect_encoding=True
                )
                try:
                    documents.extend(loader.load())
                except Exception as e:
                    print(f"⚠️ Skipping file {file}: {e}")

    return documents