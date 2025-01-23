import csv

def combine_csv(file1, file2, output_file):
    with open(file1, mode='r', encoding='utf-8') as f1, open(file2, mode='r', encoding='utf-8') as f2:
        reader1 = csv.reader(f1)
        reader2 = csv.reader(f2)

        # Read headers from both files
        header1 = next(reader1)
        header2 = next(reader2)

        # Ensure headers match
        if header1 != header2:
            raise ValueError("CSV files have different headers and cannot be combined.")

        # Combine the data
        data1 = list(reader1)
        data2 = list(reader2)

    # Write the combined data to a new file
    with open(output_file, mode='w', newline='', encoding='utf-8') as output:
        writer = csv.writer(output)

        # Write the header and combined rows
        writer.writerow(header1)
        writer.writerows(data1)
        writer.writerows(data2)

# Example usage
file1 = 'malicious_phish_cleaned2.csv'
file2 = 'URL dataset.csv'
output_file = 'combined_file.csv'

combine_csv(file1, file2, output_file)

print(f"Combined CSV saved as {output_file}")
