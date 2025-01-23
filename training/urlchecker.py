import pickle
import numpy as np
import math

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

# Function to process a single URL and predict
def predict_url(url, threshold=0.6):
    """
    Predict whether a URL is malicious or not, based on a custom threshold.
    Default threshold: 0.6 (60% probability for malicious).
    """
    # Extract features using the FeatureExtractor class
    extractor = FeatureExtractor(url)
    features = extractor.run()

    # Convert the extracted features into a format suitable for the model
    feature_values = np.array([list(features.values())]).astype(np.float32)

    # Get prediction probabilities
    prediction_proba = xgb_model.predict_proba(feature_values)
    malicious_prob = prediction_proba[0][1]
    not_malicious_prob = prediction_proba[0][0]

    # Apply custom threshold
    is_malicious = malicious_prob >= threshold

    # Display the result
    print(f"\nURL: {url}")
    print(f"Malicious Probability: {malicious_prob:.4f}")
    print(f"Not Malicious Probability: {not_malicious_prob:.4f}")
    if is_malicious:
        print("The URL is classified as: **Malicious** 🔴")
    else:
        print("The URL is classified as: **Not Malicious** 🟢")


# Main loop to allow user input
if __name__ == "__main__":
    print("URL Malicious Detection System")
    print("Enter 'exit' to quit the program.\n")

    while True:
        user_input = input("Enter a URL to check: ").strip()
        if user_input.lower() == "exit":
            print("Exiting the program. Goodbye!")
            break
        elif len(user_input) == 0:
            print("Please enter a valid URL.")
        else:
            try:
                predict_url(user_input)
            except Exception as e:
                print(f"An error occurred: {e}")
