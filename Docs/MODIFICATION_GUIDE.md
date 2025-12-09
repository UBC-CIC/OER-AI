# OER-AI - Project Modification Guide

This guide provides instructions on how to modify and extend the OER-AI project. It focuses on practical edits developers commonly need to make: styling, authentication, adding endpoints, frontend components, LLM configuration, database migrations, and deployment. For guardrail configuration and operational guidance, see `Docs/BEDROCK_GUARDRAILS.md`.

---

## Table of Contents

- [Modifying Colors and Styles](#modifying-colors-and-styles)
- [Admin & Public Token](#admin--public-token)
- [Using External Identity Providers (Enterprise SSO)](#using-external-identity-providers-enterprise-sso)
- [Extending the API](#extending-the-api)
- [Modifying Frontend Components](#modifying-frontend-components)
- [Changing Website License (Footer)](#changing-website-license-footer)
- [Configuring LLM Models](#configuring-llm-models)
- [Database Schema Changes (Migrations)](#database-schema-changes-migrations)
- [Message/Token Limit Management](#messagetoken-limit-management)
- [Data Ingestion Modifications](#data-ingestion-modifications)
- [Practice Material / Scoring Customization](#practice-material--scoring-customization)
- [Deployment & Testing](#deployment--testing)
- [Troubleshooting & Best Practices](#troubleshooting--best-practices)

---

## Modifying Colors and Styles

The frontend uses Tailwind and CSS variables for theme colors and spacing. The primary CSS variables are defined in `frontend/src/index.css`.

- Main variables in `frontend/src/index.css` (light & dark):
  - `--background`, `--foreground`, `--card`, `--primary`, `--accent`, `--border`, `--sidebar`, and many more.
  - Changing these variables will update the colors across components.

**Example** (change the primary brand color and sidebar background):

```css
/* Filepath: frontend/src/index.css */
:root {
  --primary: rgb(23, 68, 103); /* Change to your brand color */
  --sidebar: rgb(23, 68, 103); /* Sidebar background */
}

.dark {
  --primary: rgb(23, 68, 103); /* Also change for dark theme */
  --sidebar: rgb(23, 68, 103);
}
```

- The project uses `shadcn/ui` components and Tailwind utility classes; changing variables affects all UI components.
- If you want to restrict a color change to a single component, override inline styles or component-level classes.
- The built CSS is included in a prebuilt dist file (e.g., `frontend/dist/assets/index-*.css`) and is compiled through the Vite/Tailwind pipeline.

### Component-specific styling
- Components often reference colors directly (e.g., className `bg-[#2c5f7c]` in `AISettings.tsx`). To change these, search for hex codes or class names in `frontend/src/components/`.

---


## Admin & Public Token

This project uses a dual access model:
- Admin (authenticated) users: Cognito is used for sign-in and for protected admin routes. Admin users use the Cognito flows and `AuthService` to sign in (see `frontend/src/pages/Admin/AdminLogin.tsx` and `frontend/src/functions/authService.js`). Admin-only APIs require a Cognito token and are restricted to the admin authorizer in `OpenAPI_Swagger_Definition.yaml` and `cdk/lib/api-stack.ts`.
- Public (unauthenticated) users: The `publicTokenFunction` (`lambda/publicTokenFunction/publicTokenFunction.js`) generates a short-lived JWT for unauthenticated users, which the frontend uses for public features such as chat and practice generation. This token is requested and cached by `frontend/src/providers/UserSessionContext.tsx`.

How to change Admin behavior and public token settings:
- Admin Cognito configuration: `cdk/lib/api-stack.ts` configures the UserPool and AppClient. For example, update password policies, self-signup, and email templates by editing the `UserPool` configuration and re-deploying CDK.
- Public token duration/logic: `lambda/publicTokenFunction/publicTokenFunction.js` returns a JWT. Change expiry or payload `role` claims here; update the `JWT_SECRET` secret in SecretsManager to rotate signing key.
- Admin & authorizer wiring: Ensure that `OpenAPI_Swagger_Definition.yaml` and CDK stack define `adminAuthorizer` and that only admin routes use it. Public endpoints use the public token or are open.

Implementation references:
- `cdk/lib/api-stack.ts` — Cognito UserPool and API authorizer setup
- `cdk/lambda/publicTokenFunction/publicTokenFunction.js` — public token generation
- `frontend/src/providers/UserSessionContext.tsx` — public token usage
- `frontend/src/components/ProtectedRoute.tsx` — admin route protection

Note: If you want students to sign up as users (not just admins), enable `selfSignUpEnabled: true` and provide a suitable UI flow (sign up / confirm) and adapt the public-token fallback to use Cognito tokens where needed.

## Using External Identity Providers (Enterprise SSO)

For organizations that want to leverage existing identity providers instead of managing credentials directly in Cognito, Amazon Cognito allows federation with SAML and OpenID Connect (OIDC) providers. This enables secure Single Sign-On (SSO) and centralized user management.

#### What is Identity Federation?

Identity federation enables your users to authenticate using an external identity provider (Okta, Azure AD, Keycloak, etc.) and then access the application using the same identity. This allows:
- Single Sign-On across internal and external applications
- Centralized identity and access management through your enterprise IdP
- Consistent application of MFA and password policies managed by your IdP

#### Supported Federation Types

1. **SAML 2.0** - Common for enterprise IdPs
  - Examples: Okta, Shibboleth, Azure AD, OneLogin
  - AWS docs: <https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-saml-idp.html>

2. **OpenID Connect (OIDC)** - Modern OAuth-compliant providers
  - Examples: Google, Keycloak, Auth0, Azure AD
  - AWS docs: <https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-oidc-idp.html>

#### Integration notes

- Configure an identity provider in Cognito via the console or CDK (`CfnIdentityProvider`) and attach it to your user pool.
- Confirm correct attribute mappings (e.g., username, email, groups) so application roles (like `admin`) can be attributed or mapped.
- If you use a hosted UI for sign-in, update the redirect and callback URIs for the provider to include Amplify / web app endpoints.
- Consider disabling self-registration if you want to manage users via your IdP.

For further details, see the links above and the AWS documentation.

---

## Extending the API

To add a new REST API endpoint, follow these steps:

1. Add the Lambda handler code in `cdk/lambda/handlers/<your-handler>.js` or `cdk/lambda/<functionName>/src/main.py` depending on runtime.
2. Add a new function resource in `cdk/lib/api-stack.ts` (either `lambda.Function` or `lambda.DockerImageFunction`).
3. Add API Gateway method/resource route mapping to the lambda in `api-stack.ts` (the repo uses `apigw` to configure routes and authorizers).
4. Modify `OpenAPI_Swagger_Definition.yaml` to reflect the new endpoint.
5. Run `cdk deploy` to deploy the change.

Example (NodeJS lambda):

```typescript
const myHandler = new lambda.Function(this, `${id}-MyHandler`, {
  runtime: lambda.Runtime.NODEJS_22_X,
  code: lambda.Code.fromAsset("lambda"),
  handler: "handlers/myHandler.handler",
  environment: {
    SM_DB_CREDENTIALS: db.secretPathUser.secretName,
    RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
  },
});

// Add an api resource and method mapping.
const myResource = this.api.root.addResource("my-feature");
myResource.addMethod("POST", new apigw.LambdaIntegration(myHandler), { authorizer: this.adminAuthorizer });
```

Note: The project has many existing handlers under `cdk/lambda/handlers/` such as `adminHandler.js`, `textbookHandler.js`, `faqHandler.js`, and `chatSessionHandler.js` which serve as examples for patterns to follow.

---

## Modifying Frontend Components

The frontend code is in `frontend/src/` and organized as:
- `pages/` for route pages (e.g., `ChatInterface`, `FAQ`, `Admin`, `MaterialEditor`, `PracticeMaterial`)
- `components/` for reusable UI blocks (e.g., `Admin`, `ChatInterface`, `FAQPage`, `ui` based components)
- `providers/` for React context (e.g., `UserSessionContext`, `ModeContext`)
- `hooks/`, `lib/`, `utils/`, and `types/` for utility functions and types

### Adding new pages / routes
1. Create a React component in `frontend/src/pages/<YourPage>/YourPage.tsx`.
2. Export it, then add the route in `frontend/src/App.tsx` inside `<Routes>`.
3. If the page requires authentication, wrap it with `ProtectedRoute`.

Example: Adding a `NewFeature` page:

```tsx
// frontend/src/pages/NewFeature/NewFeature.tsx
export default function NewFeature() {
  return <div>New Feature page</div>;
}

// frontend/src/App.tsx
import NewFeature from "./pages/NewFeature/NewFeature";
<Route path="/new-feature" element={<NewFeature />} />
```

### Adding new components
- Create the reusable component under `frontend/src/components/` and then import it into pages or other components.
- Use Tailwind classes and the project design tokens from `index.css` to match styles.

---

## Configuring LLM Models

LLM configuration is centralized in the CDK (SSM parameters + Bedrock resources). For details specifically about Bedrock guardrails, see `Docs/BEDROCK_GUARDRAILS.md`.

### Model & embedding parameter store keys
- The LLM model ID and embedding model ID are stored as SSM parameters configured in `cdk/lib/api-stack.ts`: 
  - LLM: `/${id}/OER/BedrockLLMId` (default `meta.llama3-70b-instruct-v1:0`)
  - Embedding: `/${id}/OER/EmbeddingModelId` (default `cohere.embed-v4:0`)
  - Bedrock region: `/${id}/OER/BedrockRegion`

To change the model used by `textGeneration` or `practiceMaterial`, update the string value in `api-stack.ts` or update the SSM parameter at runtime using the CLI or console.

> For guardrail configuration and operational guidance, see `Docs/BEDROCK_GUARDRAILS.md`.

---

## Database Schema Changes (Migrations)

- Migrations are implemented using files in `cdk/lambda/db_setup/migrations/` (Knex-like migrations): `000_initial_schema.js`, `001_...`, etc.
- Add a new migration to create or modify tables, following the same pattern.

Example migration template:

```javascript
// cdk/lambda/db_setup/migrations/015_add_new_feature_table.js
exports.up = async function (knex) {
  return knex.schema.createTable('new_feature', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('description');
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTable('new_feature');
};
```

- Add the migration file and ensure it follows the naming pattern and `exports.up/exports.down` methods.

---

## Message/Token Limit Management

- Daily token limit SSM parameter is configured in `cdk/lib/api-stack.ts` (`/${id}/OER/DailyTokenLimit`) and added to `DailyTokenLimitParameter`.
- Admin APIs for reading and writing the token limit are present in `cdk/lambda/handlers/adminHandler.js` (endpoints: `GET /admin/settings/token-limit`, `PUT /admin/settings/token-limit`).
- On the frontend, `frontend/src/components/Admin/AISettings.tsx` provides a token limit editor UI calling these endpoints.

---

## Data Ingestion Modifications

- The data ingestion pipeline is handled by `cdk/lambda/dataIngestion` (Docker image lambda) and orchestrated via CDK.
- To add new file types or processors, modify `cdk/lambda/dataIngestion/src/main.py` and `helpers/` modules as needed.
- When modifying ingestion logic, add a migration if you need new DB tables to store metadata.

---

## Practice Material / Scoring Customization

- Practice material generation is implemented in `cdk/lambda/practiceMaterial/src/main.py`. The code uses Bedrock Chat/Embeddings for generation and enforces strict JSON output with JSON parsing/validation via `validate_shape` and `extract_json`.
- The generator reads model IDs from SSM parameters; update `PRACTICE_MATERIAL_MODEL_PARAM` in `cdk/lib/api-stack.ts` to change model.
- Analytics tracking is implemented in `track_practice_material_analytics(...)` and writes to `practice_material_analytics` DB table; extend this table and tracking logic for new telemetry.

**Changing generation prompts / structure**:
- Edit the `build_prompt`, `build_flashcard_prompt`, or `build_short_answer_prompt` functions to modify rules or the expected JSON structure.
- Keep JSON validation strict and update `extract_json` and `validate_shape` accordingly.

---

## Deployment & Testing

**CDK / Backend**:
1. Build CDK: `cdk` directory run `npm install` and `npm run build`.
2. Deploy: `cdk deploy` (make sure AWS credentials & region are configured)

**Python Lambda dependencies**:
- For Python lambdas, dependencies are specified in `requirements.txt` and sometimes include Dockerfile-based builds. Update Dockerfile or requirements files and re-build/push images to the ECR repositories used by CDK.

**Frontend**:
1. Install: `cd frontend` run `npm install`.
2. Run dev server: `npm run dev` (Vite)
3. Build: `npm run build`.

**Testing LLM integration**:
- Manual script (suggested): `cdk/lambda/textGeneration/test_guardrails.py` (not currently present) - see `Docs/BEDROCK_GUARDRAILS.md` for recommended guardrail test patterns and test harnesses.

**CI/CD**: The repo includes CDK stacks and Amplify hosting; follow `Docs/DEPLOYMENT_GUIDE.md` for CI/CD specifics.

---

## Troubleshooting & Best Practices

- **Lambda Timeout**: Increase `timeout` in the CDK function definition if you see timeouts.
- **Memory and Latency**: Increase `memorySize` and ensure timeouts and VPC configuration are correct.
- **Database**: Verify VPC and RDS proxy settings; check `SM_DB_CREDENTIALS` with Secrets Manager.
- **Cognito**: If the user flows fail, check user pool and client IDs in `frontend/.env` or Vite environment variables.
- **Guardrails**: For guardrail issues or unexpected blocks, consult `Docs/BEDROCK_GUARDRAILS.md` for troubleshooting. The guardrail document explains how to change topic policies, add allow rules, and test guardrail behavior.
- **Logging**: CloudWatch logs are the primary debugging source. Add logging in Lambdas where necessary.

---

## Changing Website License (Footer)

To change the website license statement (the footer text), edit the site `Footer` component which is located at `frontend/src/components/Footer.tsx`.

Example steps:

1. Open `frontend/src/components/Footer.tsx` and update the displayed text. Currently the repository has the footer defined as: `© {new Date().getFullYear()} OpenED.` Modify the string to your desired website license, e.g., `© {new Date().getFullYear()}`.

```tsx
// frontend/src/components/Footer.tsx
<div className="text-sm text-muted-foreground">
  © {new Date().getFullYear()} Generic License.
</div>
```

2. If you prefer to manage this via an environment variable or SSM parameter, you can change the footer to read from an env var or a public API config. Example using Vite env var `VITE_WEBSITE_NAME`:

```tsx
// Example: using Vite env variable
<div className="text-sm text-muted-foreground">
  © {new Date().getFullYear()} {import.meta.env.VITE_WEBSITE_NAME || 'Generic License '}.
</div>
```

3. Rebuild and redeploy the frontend (Vite / Amplify) after updating the text.

Notes:
- This is different from the textbook `license` (metadata attached to each textbook). The footer is the site license statement and needs to be changed in the site UI.
- If you have a multi-brand requirement, centralize the site name or license text via an SSM parameter or Amplify environment variable to avoid rebuilding for small content changes.



