FROM public.ecr.aws/lambda/python:3.11

# Install system dependencies needed by psycopg and pgvector
RUN yum -y install postgresql-devel gcc libpq gcc-c++ \
    && yum clean all \
    && rm -rf /var/cache/yum

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy and install Python deps
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ ${LAMBDA_TASK_ROOT}

# Entrypoint
CMD [ "main.handler" ]
