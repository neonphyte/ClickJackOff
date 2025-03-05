# 1/3/2025 01:03 --> Renamed app.py to webapp.py

from flask import Flask, request, jsonify
#from flask_cors import CORS
import pickle
import numpy as np
import math
import requests
import json
from urllib.parse import urlparse, unquote
import mimetypes
import os
import subprocess
import time
import re
from dotenv import load_dotenv
from pyhelpers.ops import is_downloadable

# Load VirusTotal API Key & Falcon Sandbox API Key
load_dotenv("key.env")
VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")

# Initialize Flask App
app = Flask (__name__)

# Enable CORS on all routes
#CORS(app)

# Home/Root directory contents to indicate that the app is live
@app.route("/")
def home ():
    return """
         <html>
            <head><title>RyanER2214 VM</title></head>
            <body>
                <h1>Links to test below; DON'T CLICK ON THEM </h1>
                <h1>Enable ClickJackoff to perform initial predictions & analysis before using secondary analysis with "Check Download Link" Button.</h1>
                <br>
                <a href="http://www.stock888.cn/" target="_blank">zk malicious link confirm plus chop. DO NOT CLICK THIS AT ALL</a>

                <br>
                <a href="https://raw.githubusercontent.com/crypto101/crypto101.github.io/master/Crypto101.pdf">Clean Link<a>

                <br>
                <a href="http://77.247.88.118:44946/bin.sh" target="_blank">Be Careful Link DO NOT CLICK</a>

                <br>
                <a href="http://122.114.193.75/demon.x64.exe.dll" target="_blank">Malicous Link DO NOT CLICK</a>
            </body>
        </html>
    """

@app.route("/checkDownloadable", methods=["POST"])
def check_downloadable():
    try:
        data = request.get_json()
        url = data.get("url")

        if not url:
            return jsonify({"error": "No URL provided"}), 400

        # Step 1: Check for downloadable indicators
        download_info = analyze_download_indicators(url)

        # Step 2: If downloadable, verify with VirusTotal & falcon sandbox
        if download_info["isDownloadable"]:
            vt_result = check_virustotal_download(url)
            fs_result = check_falconsandbox_download(url)
            download_info["vtResult"] = vt_result
            download_info["fsResult"] = fs_result # include Falcon sandbox results

            # Update Risk level based on combined results
            if fs_result and fs_result.get("status") == "completed":
                threat_score = fs_result.get("threat_score")
                verdict = fs_result.get("verdict")

                # Update download_info with Falcon Sandbox results
                download_info["fsScore"] = threat_score
                download_info["fsVerdict"] = verdict

                # Determine final risk level based on all results
                if (verdict == "malicious" or
                    vt_result.get("malicious", 0) > 0):
                    download_info["riskLevel"] = "high_risk"
                elif (verdict == "no specific threat" or
                      vt_result.get("suspicious", 0) > 0):
                    download_info["riskLevel"] = "medium_risk"

        return jsonify(download_info)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def analyze_download_indicators(url):
    try:
        parsed_url = urlparse(url)
        path = unquote(parsed_url.path.lower())

        # # Categorize risks based on checking on file extension
        # risk_categories = {
        #     'high_risk': {
        #         'executable': ['.exe', '.msi', '.dll', '.bat', '.cmd', '.sh'],
        #         'script': ['.ps1', '.vbs', '.js', '.jsp', '.jse', '.php'],
        #         'system': ['.sys', '.drv', '.bin']
        #     },
        #     'medium_risk': {
        #         'archive': ['.zip', '.rar', '.7z', '.tar.gz', '.iso'],
        #         'office': ['.doc', '.docm', '.xls', '.xlsm', '.ppt', '.pptm']
        #     },
        #     'low_risk': {
        #         'document': ['.pdf', '.docx', '.xlsx', '.pptx', '.txt'],
        #         'media': ['.mp3', '.mp4', '.jpg', '.png']
        #     }
        # }

        # Check for file extensions
#        for risk_level, categories in risk_categories.items():
#            for category, extensions in categories.items():
#                if any(path.endswith(ext) for ext in extensions):
#                    return {
#                        "isDownloadable": True,
#                        "riskLevel": risk_level,
#                        "category": category,
#                        "fileType": path.split('.')[-1],
#                        "method": "extension"
#                    }

        # check if URL is downloadable based on HTTP Headers (i.e. Content type)
        if(is_downloadable(url)):
            return{
                "isDownloadable": True
            }

        # Check headers for download indicators
        # try:
        #     head_response = requests.head(url, allow_redirects=True, timeout=5)
        #     content_type = head_response.headers.get('Content-Type', '')
        #     content_disp = head_response.headers.get('Content-Disposition', '')

        #     if 'attachment' in content_disp or 'filename' in content_disp:
        #         return {
        #             "isDownloadable": True,
        #             "riskLevel": "unknown",
        #             "method": "header",
        #             "fileType": content_type
        #         }

        # except requests.exceptions.RequestException:
        #     pass

        return {
            "isDownloadable": False,
            "message": "No download indicators detected"
        }

    except Exception as e:
        return {
            "error": True,
            "message": str(e)
        }

def extract_json_from_output(output):
    """Extract JSON content from the mixed output string"""
    json_match = re.search(r'JSON:\s*\n\s*(\{.*?\})', output, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            return None
    return None

def check_falconsandbox_download(url):
    try:
        # call falcon sandbox Wrapper & and submit URL (that leads to file download) for analysis
        submit_process = subprocess.Popen(
            f'python3 /home/ryaner2214/VxAPI/vxapi.py submit_url_to_file -v "{url}" 160',
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        submit_output, submit_error = submit_process.communicate()

        if submit_process.returncode != 0:
            print(f"Submission Error: {submit_error}")
            return

        # Parse JSON submission response to get sha256 value
        try:
            #submit_data = json.loads(submit_output)
            submit_data = extract_json_from_output(submit_output)
            sha256 = submit_data.get("sha256")
            if not sha256:
                raise Exception("No sha256 found in submission response")
        except json.JSONDecodeError:
            raise Exception("Failed to parse submission response")

         # Step 2: Wait briefly for analysis to begin (adjust time as needed)
        time.sleep(10)  # Wait 10 seconds for initial analysis

        # Step 3: Get analysis report results using sha256
        overview_process = subprocess.Popen(
                f'python3 /home/ryaner2214/VxAPI/vxapi.py overview_get_summary -v {sha256}',
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

        overview_output, overview_error = overview_process.communicate()

        if overview_process.returncode == 0:
            try:
                result_data = extract_json_from_output(overview_output)
                if result_data:
                     # Extract relevant fields
                    threat_score = result_data.get("threat_score")
                    verdict = result_data.get("verdict")

                if threat_score is not None or verdict:  # Analysis complete
                    print("\nAnalysis completed successfully!")
                    return {
                        "status": "completed",
                        "threat_score": threat_score,
                        "verdict": verdict,
                        "sha256": sha256
                    }
            except json.JSONDecodeError:
                pass

    except Exception as e:
        return {
            # return error message for why falcon sandbox failed
            "status": "error",
            "message": str(e)
        }

def check_virustotal_download(url):
    try:
        headers = {
            "x-apikey": VIRUSTOTAL_API_KEY
        }

        # Submit URL for scanning
        scan_response = requests.post(
            "https://www.virustotal.com/api/v3/urls",
            headers=headers,
            data={"url": url}
        )

        if scan_response.status_code != 200:
            return {
                "status": "error",
                "message": "VirusTotal scan submission failed"
            }

        analysis_id = scan_response.json().get("data", {}).get("id")
        report_url = f"https://www.virustotal.com/api/v3/analyses/{analysis_id}"

        # Get analysis results
        report_response = requests.get(report_url, headers=headers)

        if report_response.status_code != 200:
            return {
                "status": "error",
                "message": "Failed to get scan results"
            }

        results = report_response.json()
        stats = results.get("data", {}).get("attributes", {}).get("stats", {})

        return {
            "status": "completed",
            "malicious": stats.get("malicious", 0),
            "suspicious": stats.get("suspicious", 0),
            "harmless": stats.get("harmless", 0),
            "undetected": stats.get("undetected", 0)
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

if __name__ == "__main__":
        app.run(host = "0.0.0.0", port=5210)