import os, json
import boto3
from botocore.config import Config

BUCKET = os.environ["BUCKET"]
REGION = os.environ["REGION"]

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://s3.{REGION}.amazonaws.com",
    config=Config(
        s3={"addressing_style": "virtual"}, region_name=REGION, signature_version="s3v4"
    ),
)

def lambda_handler(event, context):
    path = event.get('path', '')
    
    if '/view' in path:
        return handle_view_request(event)
    else:
        return handle_upload_request(event)

def handle_upload_request(event):
    query_params = event.get("queryStringParameters", {})

    if not query_params:
        return {
            'statusCode': 400,
            'headers': get_cors_headers(),
            'body': json.dumps('Missing queries to generate pre-signed URL')
        }

    file_name = query_params.get("file_name", "")


    key = f"Uploads/{file_name}"

    try:
        presigned_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": BUCKET, "Key": key, "ContentType": file_type},
            ExpiresIn=300,
            HttpMethod="PUT",
        )

        return {
            "statusCode": 200,
            "headers": get_cors_headers(),
            "body": json.dumps({"presignedurl": presigned_url, "key": key}),
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps('Internal server error')
        }


def get_file_type(filename):
    if '.' in filename:
        return filename.split('.')[-1].lower()
    return 'unknown'

def get_cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
    }
