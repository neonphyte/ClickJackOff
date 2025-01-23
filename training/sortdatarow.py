import csv
import random

def randomize_csv(input_file, output_file):
    # Read the CSV file
    with open(input_file, mode='r', newline='', encoding='utf-8') as file:
        reader = list(csv.reader(file))
        header, rows = reader[0], reader[1:]

    # Shuffle the rows
    random.shuffle(rows)

    # Write the shuffled data back to a new CSV file
    with open(output_file, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(header)  # Write the header
        writer.writerows(rows)  # Write the shuffled rows

# Example usage
input_csv = 'combined_file.csv'
output_csv = 'combined_file2.csv'
randomize_csv(input_csv, output_csv)

print(f"The randomized data has been saved to {output_csv}")
