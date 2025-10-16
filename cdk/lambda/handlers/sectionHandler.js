const { initConnection, createResponse, parseBody, handleError, getSqlConnection } = require("./utils/handlerUtils.js");

(async () => {
  await initConnection();
})();

exports.handler = async (event) => {
  const response = createResponse();
  let data;
  
  try {
    const sqlConnection = getSqlConnection();
    const pathData = event.httpMethod + " " + event.resource;
    
    switch (pathData) {
      case "GET /textbooks/{id}/sections":
        const sectionsTextbookId = event.pathParameters?.id;
        if (!sectionsTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const sections = await sqlConnection`
          SELECT id, textbook_id, parent_section_id, title, order_index, page_start, page_end, summary, created_at
          FROM sections
          WHERE textbook_id = ${sectionsTextbookId}
          ORDER BY order_index ASC
        `;
        
        data = sections;
        response.body = JSON.stringify(data);
        break;
        
      case "POST /textbooks/{id}/sections":
        const postSectionsTextbookId = event.pathParameters?.id;
        if (!postSectionsTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const sectionData = parseBody(event.body);
        const { title: sectionTitle, parent_section_id, order_index, page_start: sectionPageStart, page_end: sectionPageEnd, summary: sectionSummary } = sectionData;
        if (!sectionTitle) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "title is required" });
          break;
        }
        
        const sectionTextbookExists = await sqlConnection`
          SELECT id FROM textbooks WHERE id = ${postSectionsTextbookId}
        `;
        if (sectionTextbookExists.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }
        
        const newSection = await sqlConnection`
          INSERT INTO sections (textbook_id, parent_section_id, title, order_index, page_start, page_end, summary)
          VALUES (${postSectionsTextbookId}, ${parent_section_id || null}, ${sectionTitle}, ${order_index || null}, ${sectionPageStart || null}, ${sectionPageEnd || null}, ${sectionSummary || null})
          RETURNING id, textbook_id, parent_section_id, title, order_index, page_start, page_end, summary, created_at
        `;
        
        response.statusCode = 201;
        data = newSection[0];
        response.body = JSON.stringify(data);
        break;
        
      case "GET /sections/{id}":
        const getSectionId = event.pathParameters?.id;
        if (!getSectionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Section ID is required" });
          break;
        }
        
        const section = await sqlConnection`
          SELECT id, textbook_id, parent_section_id, title, order_index, page_start, page_end, summary, created_at
          FROM sections
          WHERE id = ${getSectionId}
        `;
        
        if (section.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Section not found" });
          break;
        }
        
        data = section[0];
        response.body = JSON.stringify(data);
        break;
        
      case "PUT /sections/{id}":
        const putSectionId = event.pathParameters?.id;
        if (!putSectionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Section ID is required" });
          break;
        }
        
        const putSectionData = parseBody(event.body);
        const { title: putSectionTitle, parent_section_id: putParentSectionId, order_index: putOrderIndex, page_start: putPageStart, page_end: putPageEnd, summary: putSectionSummary } = putSectionData;
        
        const updatedSection = await sqlConnection`
          UPDATE sections 
          SET title = ${putSectionTitle}, parent_section_id = ${putParentSectionId || null}, order_index = ${putOrderIndex || null}, page_start = ${putPageStart || null}, page_end = ${putPageEnd || null}, summary = ${putSectionSummary || null}
          WHERE id = ${putSectionId}
          RETURNING id, textbook_id, parent_section_id, title, order_index, page_start, page_end, summary, created_at
        `;
        
        if (updatedSection.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Section not found" });
          break;
        }
        
        data = updatedSection[0];
        response.body = JSON.stringify(data);
        break;
        
      case "DELETE /sections/{id}":
        const deleteSectionId = event.pathParameters?.id;
        if (!deleteSectionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Section ID is required" });
          break;
        }
        
        const deletedSection = await sqlConnection`
          DELETE FROM sections WHERE id = ${deleteSectionId} RETURNING id
        `;
        
        if (deletedSection.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Section not found" });
          break;
        }
        
        response.statusCode = 204;
        response.body = "";
        break;
        
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    handleError(error, response);
  }
  
  console.log(response);
  return response;
};