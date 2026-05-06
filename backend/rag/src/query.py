from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_pinecone import PineconeVectorStore
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from functools import lru_cache

from src.embed import get_embeddings
from src.utils import OPENAI_API_KEY, PINECONE_INDEX_NAME


@lru_cache(maxsize=1)
def get_qa_chain():
    embeddings = get_embeddings()

    vectorstore = PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME,
        embedding=embeddings
    )

    retriever = vectorstore.as_retriever(search_kwargs={"k": 2})

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=OPENAI_API_KEY,
        temperature=0.2,
        max_tokens = 120
    )

    # Prompt
    prompt = ChatPromptTemplate.from_template("""
    You are a fitness expert.

    Answer the question in a precise and concise way.

    Rules:
    - Keep the answer under 3-4 sentences
    - Do NOT add extra explanations
    - Do NOT repeat the question
    - Do NOT mention "context" or "information"
    - Give only the direct answer

    If the answer is not found, say:
    "I don't know based on the available information."

    Question:
    {question}

    Information:
    {context}
    """)

    # Format retrieved docs
    def format_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)

    # Chain (NEW STYLE)
    chain = (
        {
            "context": retriever | format_docs,
            "question": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain


def ask_question(question):
    chain = get_qa_chain()
    return chain.invoke(question)
