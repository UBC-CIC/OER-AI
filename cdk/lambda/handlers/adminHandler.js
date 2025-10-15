const { initializeConnection } = require("./initializeConnection.js");
let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;

// SQL conneciton from global variable at lib.js
let sqlConnection = global.sqlConnection;

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
    },
    body: "",
  };

  // Initialize the database connection if not already initialized
  if (!sqlConnection) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }

  let data;
  try {
    const pathData = event.httpMethod + " " + event.resource;
    switch (pathData) {
      case "GET /admin/exampleEndpoint":
        data = "Example endpoint invoked";
        response.body = JSON.stringify(data);
        break;
      case "POST /admin/users":
        const { display_name, email, institution_id } = JSON.parse(event.body);
        
        const result = await sqlConnection.query(
          'INSERT INTO users (display_name, email, institution_id) VALUES ($1, $2, $3) RETURNING *',
          [display_name, email, institution_id]
        );
        
        response.statusCode = 201;
        response.body = JSON.stringify(result.rows[0]);
        break;
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    console.log(error);
    if (error.code === '23505') { // Unique constraint violation
      response.statusCode = 409;
      response.body = JSON.stringify({ error: 'Email already exists' });
    } else {
      response.statusCode = 500;
      response.body = JSON.stringify({ error: 'Internal server error' });
    }
  }
  console.log(response);
  return response;
};
