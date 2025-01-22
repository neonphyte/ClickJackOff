import pandas as pd
import numpy as np
import pickle
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
from tqdm import tqdm
import math

# Define FeatureExtractor class
class FeatureExtractor:
    def __init__(self, url=""):
        self.url = url
        self.domain = url.split('//')[-1].split('/')[0]

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

# Load the CSV file
data = pd.read_csv("combined_file2.csv")

# Extract features using the FeatureExtractor
print("Extracting features...")
features = []
for url in tqdm(data['url']):
    features.append(FeatureExtractor(url).run())
features_df = pd.DataFrame(features)

# Add the label column to the features DataFrame
features_df['type'] = data['type']

# Check class distribution
print("Class distribution:\n", features_df['type'].value_counts())

# Encode the labels (0: Not malicious, 1: Malicious)
label_encoder = LabelEncoder()
features_df['type'] = label_encoder.fit_transform(features_df['type'])

# Split data into features (X) and labels (y)
X = features_df.drop(columns=['type'])  # Drop the label column
y = features_df['type']

# Split data into train and test sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# Train the XGBoost model
print("Training XGBoost model...")
xgb_model = xgb.XGBClassifier(
    n_estimators=100, 
    max_depth=6, 
    learning_rate=0.1, 
    scale_pos_weight=(len(y_train) - sum(y_train)) / sum(y_train),  # Handle class imbalance
    use_label_encoder=False, 
    eval_metric="logloss", 
    random_state=42
)
xgb_model.fit(X_train, y_train)

# Evaluate the model
y_pred = xgb_model.predict(X_test)
print("\nClassification Report:\n", classification_report(y_test, y_pred))
print("Accuracy:", accuracy_score(y_test, y_pred))

# Save the trained model to a pickle file
with open("xgboost_model.pkl", "wb") as model_file:
    pickle.dump(xgb_model, model_file)

# Save the FeatureExtractor to a pickle file for future use
with open("feature_extractor.pkl", "wb") as extractor_file:
    pickle.dump(FeatureExtractor, extractor_file)

print("\nModel and FeatureExtractor have been saved as pickle files.")
