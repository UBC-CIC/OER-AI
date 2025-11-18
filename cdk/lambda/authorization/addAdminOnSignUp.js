const { initializeConnection } = require("./initializeConnection.js");
const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;
let sqlConnection = global.sqlConnection;

exports.handler = async (event) => {
  console.log(
    "Post-confirmation trigger event:",
    JSON.stringify(event, null, 2)
  );

  if (!sqlConnection) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }

  const { userName, request } = event;

  try {
    // Extract user attributes from the event
    const userAttributes = request.userAttributes;
    const email = userAttributes.email;
    const givenName = userAttributes.given_name || "";
    const familyName = userAttributes.family_name || "";
    const displayName = `${givenName} ${familyName}`.trim() || email;

    console.log("Creating admin user:", { email, displayName });

    // Insert the new admin user into the Users table
    const result = await sqlConnection`
      INSERT INTO users (display_name, email, role, created_at, updated_at)
      VALUES (${displayName}, ${email}, 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE 
      SET updated_at = CURRENT_TIMESTAMP
      RETURNING id, email, role
    `;

    console.log("Admin user created/updated:", result[0]);

    // IMPORTANT: For Cognito triggers, you must return the event object
    return event;
  } catch (err) {
    console.error("Error inserting admin user into database:", err);
    // Even on error, return the event to allow sign-up to complete
    // The user can still authenticate, but won't be in the database yet
    return event;
  }
};
