exports.handler = async (event) => {
  console.log("WebSocket connection closed:", {
    connectionId: event.requestContext.connectionId,
    domainName: event.requestContext.domainName,
    stage: event.requestContext.stage,
    timestamp: new Date().toISOString(),
  });

  return { statusCode: 200 };
};
