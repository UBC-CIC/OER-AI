const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const jwt = require("jsonwebtoken");

const secretsManager = new SecretsManagerClient();
let cachedSecret;

exports.handler = async (event) => {
  const token = event.authorizationToken?.replace("Bearer ", "");

  if (!token) {
    console.warn("No token provided");
    throw new Error("Unauthorized");
  }

  try {
    if (!cachedSecret) {
      const response = await secretsManager.send(
        new GetSecretValueCommand({ SecretId: process.env.JWT_SECRET })
      );
      cachedSecret = JSON.parse(response.SecretString).jwtSecret;
    }

    const decoded = jwt.verify(token, cachedSecret);

    // Extract API Gateway ARN parts to create wildcard resource
    // methodArn format: arn:aws:execute-api:region:account:apiId/stage/method/resource
    const arnParts = event.methodArn.split('/');
    const apiGatewayArnPrefix = arnParts.slice(0, 2).join('/'); // arn:aws:execute-api:region:account:apiId/stage
    const wildcardResource = `${apiGatewayArnPrefix}/*/*`; // Allow all methods and resources

    const policy = generatePolicy(
      decoded.sub || "user",
      "Allow",
      wildcardResource
    );
    policy.context = {
      userId: decoded.sub || "user",
      ...decoded,
    };
    return policy;
  } catch (err) {
    console.error("Authorization error:", err.message);
    throw new Error("Unauthorized");
  }
};

function generatePolicy(principalId, effect, resource) {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}