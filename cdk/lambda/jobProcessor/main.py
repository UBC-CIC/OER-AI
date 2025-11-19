import json
import os
import boto3
import logging
from datetime import datetime
from typing import Dict, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION = os.environ.get('REGION', 'us-east-1')
GLUE_JOB_NAME = os.environ.get('GLUE_JOB_NAME')

# Initialize AWS clients
glue_client = boto3.client('glue', region_name=REGION)

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda function to process SQS messages and trigger Glue jobs for testing
    """
    logger.info("=== JOB PROCESSOR LAMBDA START ===")
    logger.info(f"Environment - GLUE_JOB_NAME: {GLUE_JOB_NAME}")
    logger.info(f"Environment - REGION: {REGION}")
    logger.info(f"Received SQS event: {json.dumps(event, default=str)}")
    
    results = []
    
    for record in event.get('Records', []):
        try:
            logger.info(f"=== Processing SQS Record ===")
            logger.info(f"Message ID: {record.get('messageId')}")
            logger.info(f"Receipt Handle: {record.get('receiptHandle', 'N/A')}")
            
            # Parse the SQS message
            message_body = json.loads(record['body'])
            logger.info(f"SQS Message Body: {message_body}")
            
            # Use the configured Glue job name
            job_name = GLUE_JOB_NAME
            if not job_name:
                raise ValueError("GLUE_JOB_NAME environment variable not set")
            
            # Create a unique batch ID for this run
            batch_id = f"batch-{int(datetime.now().timestamp())}"
            
            # Prepare Glue job arguments - pass SQS message data as job parameters
            glue_job_args = {
                '--batch_id': batch_id,
                '--sqs_message_id': record.get('messageId', 'unknown'),
                '--sqs_message_body': json.dumps(message_body),
                '--trigger_timestamp': datetime.now().isoformat(),
            }
            
            logger.info(f"=== Starting Glue Job ===")
            logger.info(f"Job Name: {job_name}")
            logger.info(f"Job Arguments: {glue_job_args}")
            
            # Start the Glue job
            response = glue_client.start_job_run(
                JobName=job_name,
                Arguments=glue_job_args
            )
            
            logger.info(f"✅ Glue job started successfully!")
            logger.info(f"JobRunId: {response['JobRunId']}")
            
            results.append({
                'messageId': record['messageId'],
                'status': 'success',
                'glueJobRunId': response['JobRunId'],
                'jobName': job_name,
                'batchId': batch_id,
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as error:
            logger.error(f"❌ Error processing message {record.get('messageId', 'unknown')}: {str(error)}")
            
            results.append({
                'messageId': record.get('messageId', 'unknown'),
                'status': 'error',
                'error': str(error),
                'timestamp': datetime.now().isoformat()
            })
    
    response_body = {
        'message': 'SQS messages processed - Glue jobs triggered',
        'results': results,
        'processedCount': len(results),
        'successCount': len([r for r in results if r['status'] == 'success']),
        'errorCount': len([r for r in results if r['status'] == 'error'])
    }
    
    logger.info("=== JOB PROCESSOR LAMBDA COMPLETE ===")
    logger.info(f"Final Results: {response_body}")
    
    return {
        'statusCode': 200,
        'body': json.dumps(response_body, default=str)
    }