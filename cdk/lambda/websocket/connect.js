exports.handler = async (event) => {
  console.log("WebSocket connection established:", {
    connectionId: event.requestContext.connectionId,
    domainName: event.requestContext.domainName,
    stage: event.requestContext.stage,
    timestamp: new Date().toISOString(),
  });

  return { statusCode: 200 };
};
