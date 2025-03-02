from flask import Flask, request, jsonify
import pickle
import numpy as np
import math
import requests
import os
import time
from dotenv import load_dotenv

load_dotenv("key.env")


# Define the FeatureExtractor class
class FeatureExtractor:
    def __init__(self, url=""):
        self.url = self._preprocess_url(url)
        self.domain = self.url.split('/')[0]

    def _preprocess_url(self, url):
        # Remove http, https, and www.
        url = url.replace("http://", "").replace("https://", "").replace("www.", "")
        return url.strip('/')

    def url_entropy(self):
        url_trimmed = self.url.strip()
        entropy_distribution = [float(url_trimmed.count(c)) / len(url_trimmed) for c in dict.fromkeys(list(url_trimmed))]
        return -sum([e * math.log(e, 2) for e in entropy_distribution if e > 0])

    def digits_num(self):
        return len([i for i in self.url if i.isdigit()])

    def length(self):
        return len(self.url)

    def params_num(self):
        return len(self.url.split('&')) - 1

    def fragments_num(self):
        return len(self.url.split('#')) - 1

    def subdomain_num(self):
        return len(self.domain.split('.')) - 1

    def has_http(self):
        return 'http' in self.url

    def has_https(self):
        return 'https' in self.url

    def is_ip(self):
        parts = self.domain.split('.')
        if len(parts) == 4 and all(part.isdigit() and 0 <= int(part) <= 255 for part in parts):
            return True
        return False

    def run(self):
        return {
            "url_entropy": self.url_entropy(),
            "digits_num": self.digits_num(),
            "length": self.length(),
            "params_num": self.params_num(),
            "fragments_num": self.fragments_num(),
            "subdomain_num": self.subdomain_num(),
            "has_http": int(self.has_http()),
            "has_https": int(self.has_https()),
            "is_ip": int(self.is_ip()),
        }

# Load the trained XGBoost model
with open("xgboost_model.pkl", "rb") as model_file:
    xgb_model = pickle.load(model_file)

# Initialize Flask app
app = Flask(__name__)

# VirusTotal API Key (Use environment variable for security)
VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")

def evaluate_virustotal_report(report):
    stats = report.get("data", {}).get("attributes", {}).get("stats", {})

    malicious = stats.get("malicious", 0)
    harmless = stats.get("harmless", 0)
    undetected = stats.get("undetected", 0)
    suspicious = stats.get("suspicious", 0)

    total_vendors = malicious + harmless + undetected + suspicious

    if (malicious + suspicious) > 1:
        return "Malicious"
    else:
        return "Safe"

    # Define strict classification
    #return "Malicious" if malicious > 0 else "Safe"

# Modify your VirusTotal API function to include risk evaluation
def check_virustotal(url):
    headers = {
        "x-apikey": VIRUSTOTAL_API_KEY,
        "content-type": "application/x-www-form-urlencoded"
    }

    try:
        # Step 1: Submit URL for analysis
        response = requests.post(
            "https://www.virustotal.com/api/v3/urls",
            headers=headers,
            data={"url": url},
            timeout=5
        )
        response.raise_for_status()

        analysis_id = response.json().get("data", {}).get("id")
        if not analysis_id:
            raise ValueError("Missing analysis_id")

        # Wait for VirusTotal to analyze
        time.sleep(10)  # Adjust this wait if needed

        # Step 2: Retrieve analysis report
        report_url = f"https://www.virustotal.com/api/v3/analyses/{analysis_id}"
        report_response = requests.get(report_url, headers=headers, timeout=10)

        # If VT is still not ready, wait a bit more
        retry = 0
        while report_response.status_code == 409 and retry < 3:  # ConflictError handling
            time.sleep(5)
            report_response = requests.get(report_url, headers=headers, timeout=10)
            retry += 1

        report_response.raise_for_status()

        report_data = report_response.json()
        risk_level = evaluate_virustotal_report(report_data)
        stats = report_data.get("data", {}).get("attributes", {}).get("stats", {})

        return {
            "risk": risk_level,
            "stats": {
                "malicious": stats.get("malicious", 0),
                "harmless": stats.get("harmless", 0),
                "undetected": stats.get("undetected", 0),
                "suspicious": stats.get("suspicious", 0),
                "timeout": stats.get("timeout", 0)
            }
        }

    except requests.exceptions.RequestException as e:
        return {
            "risk": "Malicious",
            "error": f"VT request error: {str(e)}",
            "stats": {
                "malicious": 0,
                "harmless": 0,
                "undetected": 0,
                "suspicious": 0,
                "timeout": 0
            }
        }

# Define the predict route
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        url = data.get("url", "")

        if not url:
            return jsonify({"error": "No URL provided"}), 400

        extractor = FeatureExtractor(url)
        features = extractor.run()
        feature_values = np.array([list(features.values())]).astype(np.float32)

        prediction_proba = xgb_model.predict_proba(feature_values)
        malicious_prob = float(prediction_proba[0][1])
        not_malicious_prob = float(prediction_proba[0][0])

        threshold = 0.4
        is_malicious = malicious_prob >= threshold

        virustotal_result = "Not checked"
        vt_stats = {
            "malicious": 0,
            "harmless": 0,
            "undetected": 0,
            "suspicious": 0,
            "timeout": 0
        }
        vt_error = None  # New addition to hold VT error clearly

        if is_malicious:
            vt_result_full = check_virustotal(url)
            virustotal_result = vt_result_full.get("risk", "Safe")
            vt_stats = vt_result_full.get("stats", vt_stats)
            vt_error = vt_result_full.get("error")  # Grab error message from VT clearly if it exists

        return jsonify({
            "url": url,
            "malicious_probability": round(malicious_prob, 4),
            "not_malicious_probability": round(not_malicious_prob, 4),
            "prediction": "Malicious" if is_malicious else "Safe",
            "threshold": threshold,
            "virustotal": virustotal_result,
            "virustotal_stats": vt_stats,
            "virustotal_error": vt_error  # Now return the VT error message explicitly
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Home route to indicate the app is live
@app.route("/")
def home():
    return """
        <html>
            <head><title>Websec2C</title></head>
            <body>
                <h1>Links to test, please don't press the links</h1>
                <a href="https://xsite.singaporetech.edu.sg" target="_blank">ML scam VT safe</a>
		<br>
		<a href="https://i1.wp.com/" target="_blank">ML scam VT safe</a>
		<br>
		<a href="https://123moviesz.site/" target="_blank">ML scam VT safe</a>
		<br>
		<a href="https://www.google.com/finance?cid=6512" target="_blank">ML safe VT no run</a>
        <br>
        <a href="http://www.stock888.cn/" target="_blank">ML scam VT scam</a>
        

            </body>
        </html>
    """

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)