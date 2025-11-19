import json
import csv
import os
import boto3
import re
from datetime import datetime
from io import StringIO
from urllib.parse import unquote_plus

REGION = os.environ.get('REGION', 'us-east-1')
s3_client = boto3.client('s3', region_name=REGION)
sqs_client = boto3.client('sqs', region_name=REGION)

def handler(event, context):
    """
    Lambda handler to process CSV files uploaded to S3 and send links to SQS queue
    """
    print(f"Event received: {json.dumps(event)}")
    
    try:
        # Process each S3 record from the event
        for record in event['Records']:
            bucket = record['s3']['bucket']['name']
            key = unquote_plus(record['s3']['object']['key'])
            
            print(f"Processing file: {key} from bucket: {bucket}")
            
            # Only process CSV files
            if not key.lower().endswith('.csv'):
                print(f"Skipping non-CSV file: {key}")
                continue
            
            # Get the CSV file from S3
            response = s3_client.get_object(Bucket=bucket, Key=key)
            csv_content = response['Body'].read().decode('utf-8')
            
            # Parse CSV content
            csv_reader = csv.DictReader(StringIO(csv_content))
            records = list(csv_reader)
            
            print(f"Parsed {len(records)} records from CSV")
            
            # Process each record and send to SQS
            success_count = 0
            error_count = 0
            
            for index, csv_record in enumerate(records):
                try:
                    # Extract the source URL from the CSV record
                    link = csv_record.get('Source')
                    
                    if not link:
                        print(f"No 'Source' link found in record {index + 1}: {csv_record}")
                        error_count += 1
                        continue
                    
                    # Prepare message for SQS with structured metadata
                    message_body = {
                        'link': link,
                        'metadata': {
                            'source': 'csv-upload',
                            'bucket': bucket,
                            'csvFile': key,
                            'recordIndex': index,
                            'timestamp': datetime.utcnow().isoformat(),
                            'title': csv_record.get('Title', ''),
                            'author': csv_record.get('Author', ''),
                            'licence': csv_record.get('Licence', ''),
                            'numberOfH5P': csv_record.get('Number of H5P', ''),
                            'visits12Months': csv_record.get('Visits (past 12 months)', ''),
                            'visitsMonthlyAvg': csv_record.get('Visits (monthly average)', ''),
                            'bookId': csv_record.get('Book ID', '')
                        }
                    }
                    
                    # Send message to SQS FIFO queue
                    # Sanitize key for use in MessageGroupId and MessageDeduplicationId
                    # (alphanumeric, hyphens, underscores only)
                    sanitized_key = re.sub(r'[^a-zA-Z0-9-_]', '_', key)
                    message_group_id = f"csv-{sanitized_key}"
                    deduplication_id = f"{sanitized_key}-{index}-{int(datetime.utcnow().timestamp() * 1000)}"
                    
                    sqs_client.send_message(
                        QueueUrl=os.environ['QUEUE_URL'],
                        MessageBody=json.dumps(message_body),
                        MessageGroupId=message_group_id,
                        MessageDeduplicationId=deduplication_id
                    )
                    
                    success_count += 1
                    print(f"Sent link {index + 1} to SQS: {link}")
                    
                except Exception as error:
                    print(f"Error processing record {index + 1}: {str(error)}")
                    error_count += 1
            
            print(f"Processing complete for {key}: {success_count} successful, {error_count} errors")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'CSV processing completed successfully'
            })
        }
        
    except Exception as error:
        print(f"Error processing CSV: {str(error)}")
        raise error
