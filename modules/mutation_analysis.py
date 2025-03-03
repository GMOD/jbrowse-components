import streamlit as st
import requests
import os
from openai import OpenAI
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Constants
GENOMIC_API_URL = "https://genomic-api-url.com/analyze"
CLINVAR_API_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
COSMIC_API_URL = "https://cancer.sanger.ac.uk/cosmic/api/v1"

# Load API keys from .env
openai_api_key = os.getenv("OPENAI_API_KEY", "")
cosmic_api_key = os.getenv("COSMIC_API_KEY", "")

# Initialize OpenAI
openai = OpenAI(api_key=openai_api_key)

# Function to analyze genomic data
def analyze_genomic_data(genomic_data):
    response = requests.post(GENOMIC_API_URL, json=genomic_data)
    return response.json()

# Function to fetch data from ClinVar
def fetch_clinvar_data(query):
    params = {
        "db": "clinvar",
        "term": query,
        "retmode": "json"
    }
    response = requests.get(CLINVAR_API_URL, params=params)
    return response.json()

# Function to fetch data from COSMIC
def fetch_cosmic_data(query):
    headers = {
        "Authorization": f"Bearer {cosmic_api_key}"
    }
    response = requests.get(f"{COSMIC_API_URL}/mutations?q={query}", headers=headers)
    return response.json()

# Streamlit app
st.title("Genomic Data Analysis")

uploaded_file = st.file_uploader("Upload your genomic data file", type=["txt", "csv", "json"])

if uploaded_file is not None:
    genomic_data = uploaded_file.read()
    analysis_results = analyze_genomic_data(genomic_data)
    
    st.subheader("Analysis Results")
    st.write(analysis_results)
    
    st.subheader("ClinVar Data")
    clinvar_results = fetch_clinvar_data(analysis_results.get("query"))
    st.write(clinvar_results)
    
    st.subheader("COSMIC Data")
    cosmic_results = fetch_cosmic_data(analysis_results.get("query"))
    st.write(cosmic_results)
    
    st.subheader("AI-Driven Insights")
    ai_response = openai.Completion.create(
        engine="davinci",
        prompt=f"Analyze these genomic results: {analysis_results}",
        max_tokens=150
    )
    st.write(ai_response.choices[0].text)
