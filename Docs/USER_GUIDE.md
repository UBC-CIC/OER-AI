# User Guide

**Before you start:** confirm the app is deployed using the deployment guide at `Docs/DEPLOYMENT_GUIDE.md`.

This document summarizes the main user flows, UI controls, and administrative actions in the OpenED AI Assistant frontend. It reflects the current UI and behavior implemented in the frontend code (chat, prompts, practice generation, audio, and admin features).

| Index    | Description |
| -------- | ------- |
| [Getting Started](#getting-started) | Create an account and get started with the app |
| [Student View](#student-view) | Browse textbooks, use the Chat interface, and generate practice materials |
| [Instructor View](#instructor-view) | Create, edit, and export practice materials (H5P / PDF) |
| [Administrator View](#administrator-view) | Admin dashboards: ingestion, moderation, AI settings, analytics |

---

## Getting Started

1. Open the hosted site (Amplify URL provided in the deployment process) or run the frontend locally.
2. Click **Sign Up** to register an account (Cognito-backed sign up flow).
3. Verify your email with the code sent to your inbox.
4. Sign in with your credentials.

Notes:
- After first login you will be assigned a regular user role (Student) by default.
- Admin roles are provisioned via Cognito user group membership or by an existing admin.
- If the app uses SSO or pre-provisioned accounts, follow the admin instructions for onboarding.

---

## Student View

This is the default experience and contains: textbook catalog, Chat (Study Companion), FAQ, Practice Materials, Shared Prompts, and audio accessibility settings.

### Home / Textbook Catalog

- Browse textbook cards with title, author, and cover image. Use the search bar to find textbooks by title or author.
- Click a textbook to view the textbook dashboard, which includes Chat, FAQ, Practice, and (for instructors) Material Editor.

### Chat (Study Companion)

- Open the Sidebar to select existing chat sessions or create a new session with the **+** button.
- Type messages into the Chat input; press **Enter** to send (Shift+Enter inserts a newline).
- Responses stream as the model generates them and may contain sources (citations) displayed below the reply.
- The Chat supports prompt templates and guided prompts — open the Prompt Library to browse or apply templates.
- Session data is stored in localStorage and is valid for approximately 30 days; sessions are temporary and not a durable storage mechanism.

Sharing & forked sessions:
- Use the **Share** button to generate a public URL for the conversation. A privacy notice will appear before proceeding; you can dismiss it permanently using localStorage.
- If you open a shared chat URL (`?share=<SESSION_ID>`), you can preview and optionally fork the conversation into your own session.

### FAQ

- The FAQ for each textbook lists commonly asked questions and the canonical answer.
- Clicking a FAQ loads it as a pre-filled question into the Chat UI and increments its usage count.
- To report an FAQ, open the FAQ card's action menu (three dots) and choose Report; a dialog appears to submit a reason or comment.

### Practice Materials

- Use the Practice tab to generate MCQs, Flashcards, and Short Answer question sets.
- Validations and generation constraints (client-side):
  - MCQ: up to 8 questions, up to 8 options per question
  - Flashcards: up to 20 cards
  - Short Answer: up to 10 questions
- Generated materials are session-scoped and can be exported.

Exporting & Grading:
- Export to PDF or H5P: Use the Export action for generated materials to download a PDF or H5P .zip package (H5P uses a backend packaging endpoint that returns a downloadable zip file).
- The Short Answer material type supports a text grading/feedback flow (AI-assisted). The UI will show grading results where applicable.

### Shared Prompts

- Browse prompts shared by other users in the Shared Prompts tab.
- Use the inline prompt card to insert the prompt into your chat session.
- Report inappropriate shared prompts using the inline Flag icon on the prompt card.

### Audio Controls

- Open Audio Settings from the Sidebar to enable Narration, Autoplay, and choose which messages should be read (`Both`, `AI only`, `User only`).
- Choose Voice, and set Rate, Pitch, and Volume. Use Play Sample to preview the voice.

---

## Instructor View

Switch to Instructor mode via the Mode selector (top header). Instructors have access to the Material Editor and additional tools.

### Material Editor & H5P Export

- Use the Material Editor to review and edit MCQ, Short Answer, and Flashcard sets.
- Edit questions, re-order, add options or explanations, and then export edits to H5P or PDF.
- H5P export triggers the server-side packaging process and returns a downloadable zip file that can be imported into LMS platforms like Canvas or Moodle.

---

## Administrator View

Administrators log in via `/admin/login` and perform ingestion, metadata, moderation, and system configuration tasks.

### Textbook Management & Ingestion

- View ingestion status, job history, and content ingestion statistics in the Textbooks page.
- Add or update textbook metadata and trigger re-ingestion when necessary (depending on your deployment). Some installations may allow you to upload files directly; others use a source URL.

### AI System & Operational Settings

- Manage the system prompt, set token limits, and update operational settings in AI Settings.

### Analytics

- Console shows usage and activity metrics such as chat counts, prompt usage, and practice generation activity.

### Reported Content & Moderation

- Review reported items for FAQ and shared prompts; each report includes optional user comments.
- Actions available: dismiss a report or delete the flagged item.

---

## Reporting & Moderation Flow

- Shared Prompts use an inline Flag control for reporting (opens a dialog for optional comments).
- FAQ entries use the action menu to report content (opens a report dialog).
- Admins receive reports in the Admin dashboard under Reported Items.

---

## Troubleshooting & Best Practices

Troubleshooting tips:
- If the frontend cannot reach the backend, verify your `VITE_API_ENDPOINT` setting and Amplify configuration.
- For audio issues, check browser permissions and the selected voice.
- If H5P export fails, check the API logs and ensure the packaging backend is reachable.
- For WebSocket (chat streaming) issues, inspect the browser console for WebSocket endpoints and network errors.

Best practices:
- Be specific with user questions and include a textbook section or page reference to improve source relevance.
- Use the Prompt Library and Guided Prompts to generate repeatable, reproducible prompts.
- Avoid sharing personally identifiable or sensitive information in public shared chat links.
- Export practice sets to H5P or PDF if you require persistent content beyond the session (session data persists for ~30 days).

---

## Additional Resources

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- API Documentation: available at your API Gateway endpoint (if applicable)
# User Guide

**Please ensure the application is deployed first using the Deployment Guide:**
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

This user guide outlines how to interact with the OER OpenED AI Assistant web application. It follows the structure of the product UI and describes common user flows for Students, Instructors, and Administrators.

| Index    | Description |
| -------- | ------- |
| [Getting Started](#getting-started) | How to create an account and access the application |
| [Student View](#student-view) | Browse textbooks, chat with the AI assistant, and generate practice materials |
| [Instructor View](#instructor-view) | Create, edit and export practice materials (H5P/PDF) |
| [Administrator View](#administrator-view) | Administrative operations such as textbook ingestion, AI settings, analytics and reported content |

---

## Getting Started

All users access the application through the public URL provided by Amplify, or locally when running the frontend in development.

### Creating an Account

1. Open the site URL (Amplify domain or local host).
2. Click **Sign Up** or **Create Account** to register.
3. Enter your email, create a secure password, and follow the on-screen prompts.
4. You will receive a verification code via email. Enter the code to confirm your account.
5. After confirming, sign in with your credentials.

Notes:
- On first login, you are registered as a regular user (student role) by default.
- Admin accounts and permissions are managed separately via Cognito (see Administrator View).

---

## Student View

The Student view is the default experience and includes textbook browsing, the Chat interface, Practice Material generation, and the FAQ.

### Home / Textbook Catalog

- The homepage lists available textbooks: cover, title, authors, and a short summary.
- Search textbooks by title or author using the search input.
- Click a textbook card to open the textbook dashboard (Chat, FAQ, Practice tabs).

### Chat (Study Companion)

- The Chat interface is the primary study tool and is context-aware of the currently selected textbook.
- To start a new chat session, click **+** (New chat) in the Sidebar.
- Type a message in the input area; press **Enter** to send or **Shift+Enter** to insert a newline.
- The assistant streams responses (you’ll see a typing/streaming indicator) and may include source citations below replies.
- Chat sessions are stored in your browser session via localStorage (session data persists for about 30 days).

Prompt templates & guided prompts:
- Click the **Prompt Library** icon in the Chat interface to browse built-in and shared templates.
- Guided prompt templates walk you through multiple questions—follow the sequence to complete the guided flow.

Sharing & forking:
- Click the **Share** button in the chat to generate a public URL that others can open.
- A privacy notice appears before the share flow; the notice can be dismissed permanently via localStorage.
- Opening a `?share=<SESSION_ID>` URL will let you preview the conversation and optionally fork it into a new session.

Managing sessions:
- All sessions for the current textbook appear in the Sidebar; click any to view history.

### FAQ

- The FAQ lists common questions for the selected textbook.
- Click a FAQ to load the question into the chat (the FAQ usage counter will increment).
- To report inappropriate FAQ content, use the report action (in current UX the action is available via the three-dot menu on a FAQ card — which opens a report dialog).

### Practice Materials

- Use the Practice tab to generate MCQ, Flashcards, or Short Answer items for a selected topic.
- Form constraints validated client-side:
  - MCQ: up to 8 questions, up to 8 options per question
  - Flashcards: up to 20 cards
  - Short Answer: up to 10 questions
- Generated items appear on the Practice page and are session-bound.

Exporting & grading:
- Generated content can be exported as a PDF or as an H5P package (LMS-compatible) via the Export controls.
- H5P export triggers a backend packaging endpoint (`/textbooks/{id}/practice_materials/export-h5p`) and will prompt a .zip download; if export fails, the UI surfaces an error.
- Short Answer items may contain a “Grade My Answer” feature to get AI feedback on short text responses.

---

## Instructor View

Instructor mode unlocks the `Material Editor` link in the Sidebar for users with the instructor role.

### Switching Modes

- Use the Mode selector in the header to switch between `Student` and `Instructor` modes.
- The app attempts a backend update of your role when switching; if it fails the UI rolls back the change.

### Material Editor

- Generate materials from the Practice tab then click **Edit in Material Editor** to refine content.
- The editor supports creating and editing MCQ, Short Answer, and Flashcard content.
- You can export edited sets to H5P (.zip) for import into LMS systems (e.g., Canvas, Moodle) or as PDFs for printing.

Notes:
- H5P export is performed via a server-side job and returns a downloadable zip file that contains the H5P package.

---

## Administrator View

Administrators access the Admin dashboard at `/admin/login` and have advanced operations such as textbook ingestion, AI settings, analytics, and managing reported content.

### Becoming an Admin

- Admin membership is controlled by Cognito user pool groups. An admin user is typically added by an existing admin via the AWS Console or by updating group membership in the Cognito User Pool.

### Textbook Management

- View textbook ingestion status, job history, and ingestion statistics.
- Add new textbooks or configure a source URL for ingestion depending on your deployment.
- Trigger re-ingestion or refresh content as necessary.

### AI Settings & System Prompts

- Configure the system prompt that influences AI behavior and any model/API integration options exposed in your deployment.
- Set limits and guardrails such as daily token limits per user.

### Analytics

- Review usage metrics, including chat counts, practice generation events, and other time-series analytics.

### Reported Content

- Review flagged items (FAQ entries, shared prompts) and take moderation actions: dismiss, delete, or review for follow-up.

---

## Reporting & Moderation

- The product provides reporting flows for Shared Prompts and FAQ entries; users can flag content for review via the UI.
- Reports surface in the Admin dashboard; Admins can dismiss or delete entries.

---

## Audio & Accessibility

- Open the Audio popover in the Sidebar to configure Narration, Autoplay, Voice, Rate, Pitch, and Volume.
- Use **Play Sample** to test a voice and settings without waiting for an assistant response.

---

## Troubleshooting & Tips

- If the app fails to fetch or communicate with the backend, check the environment variable `VITE_API_ENDPOINT` or the Amplify domain used for hosting.
- If audio playback doesn't work, confirm browser audio permissions and choose a different voice if available.
- If H5P export or PDF export fails, confirm the backend export endpoint is reachable and the file packaging job completes successfully.
- For WebSocket streaming issues, check browser console logs for the WebSocket URL and network health.

Best practices:
- Keep prompts specific (include section or paragraph references when possible)
- Use Prompt Library and Guided Prompts for reproducible results
- Don’t share sensitive or personal data in public shared chat URLs
- Export practice materials to persist content beyond temporary sessions (sessions are stored for ~30 days)

---

## Additional Resources

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- API Documentation: Available through the deployed API
# User Guide

**Please ensure the application is deployed, instructions in the deployment guide here:**
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

Once you have deployed the solution, the following user guide will help you navigate the functions available.

| Index    | Description |
| -------- | ------- |
| [Getting Started](#getting-started) | Create an account and access the application |
| [Administrator View](#administrator-view) | Manage textbooks, settings, analytics, and reported content |
| [Student View](#student-view) | Browse textbooks, chat with AI assistant, and generate practice materials |
| [Instructor View](#instructor-view) | Create and edit practice materials with H5P export |

## Getting Started

All users start by accessing the application through the Amplify-hosted URL provided after deployment.

### Creating an Account

1. Navigate to the application URL
2. Click "Sign Up" to create a new account
3. Fill in your information (email, password)
4. Check your email for a verification code
5. Enter the verification code to activate your account
6. Log in with your credentials

Upon first login, you are registered as a regular user (student role by default).

---

## Administrator View

### Becoming an Administrator

To become an administrator, you need to change your user group through AWS Cognito Console:

1. Go to **AWS Console** → **Cognito** → **User Pools**
2. Select your project's user pool (e.g., `<STACK-PREFIX>-UserPool`)
3. Navigate to **"Users"** in the left sidebar
4. Find and click on your email address
5. Scroll down to **"Group memberships"** and click **"Add user to group"**
6. Select the **"admin"** group from available options
7. Confirm the user has been added to the admin group

### Admin Dashboard

Upon logging in as an administrator at `/admin/login`, you see the admin dashboard with access to:

#### Textbook Management

Navigate to **"Textbooks"** to view all textbooks in the system.

**View Textbook Details:**
- Click on any textbook to see detailed information including:
  - Title, authors, publisher, and publication date
  - User count and question count statistics
  - Section count, image count, video count, and audio count
  - Ingestion status and job history

**Add New Textbook:**
1. Click **"Add Textbook"** button
2. Fill in textbook metadata (title, authors, publisher, etc.)
3. Upload the textbook file or provide source URL
4. Click **"Create"** to start the ingestion process

**Edit Textbook:**
1. Click on a textbook from the list
2. Click **"Edit"** button
3. Update textbook information
4. Click **"Save"** to apply changes

**Refresh/Re-ingest Textbook:**
1. Click on a textbook
2. Click **"Refresh"** button to trigger re-ingestion
3. Monitor ingestion progress from the jobs tab

#### AI Settings

Navigate to **"AI Settings"** to configure system behavior.

**Set Daily Token Limit:**
- Enter a number to limit daily tokens per user
- Enter "NONE" for unlimited tokens
- Click **"Save"** to apply

**Update System Prompt:**
- Edit the system prompt that guides the AI assistant's behavior
- View previous system prompt versions
- Click **"Save"** to update

**Configure Welcome Message:**
- Edit the welcome message displayed on the homepage
- Click **"Save"** to update

#### Analytics

Navigate to **"Analytics"** to view usage statistics:

- Time series data showing users and questions over time
- Chat sessions by textbook
- Practice material generation statistics
- Filter by time range (7 days, 30 days, 3 months)

#### Reported Content

Navigate to **"Reported Items"** to manage flagged content:

**Review Reported FAQs:**
- View all reported FAQ entries
- Click **"Dismiss"** to clear the report
- Click **"Delete"** to remove the FAQ permanently

**Review Reported Prompts:**
- View all reported shared prompts
- Click **"Dismiss"** to clear the report
- Click **"Delete"** to remove the prompt permanently

---

## Student View

Upon logging in as a student, you see the home page with the textbook catalog and welcome message.

### Browsing Textbooks

The home page displays all available textbooks with:
- Textbook cover image
- Title and authors
- Publisher and publication information
- Summary description

**Search and Filter:**
- Use the search bar to find textbooks by title or author
- Browse through the paginated list

**Select a Textbook:**
- Click on any textbook card to open the textbook dashboard

### Textbook Dashboard

After selecting a textbook, you see the textbook dashboard with tabs:

#### Chat Tab

The Chat interface is the core study tool for interacting with the AI assistant.

**Starting a New Chat:**
1. Click the **"+"** (New chat) button in the sidebar
2. A new chat session is created for the current textbook

**Asking Questions:**
1. Type your question in the input area at the bottom
2. Press **Enter** to send (use **Shift+Enter** for new lines)
3. The AI assistant responds with relevant information from the textbook
4. Source citations appear below responses when available

**Using Prompt Templates:**
1. Click the **"Prompt Library"** icon
2. Browse available prompt templates
3. Click a template to use it in your chat
4. Follow guided prompts if the template includes multiple questions

**Sharing Conversations:**
1. Click the **"Share"** icon in the chat interface
2. A public URL is generated for the conversation
3. Copy and share the URL with others
4. Note: Shared chats are publicly accessible

**Forking Shared Chats:**
- When you open a shared chat URL (`?share=<sessionId>`)
- Click **"Fork"** to create your own copy of the conversation
- Continue the conversation in your own session

**Managing Chat Sessions:**
- View all chat sessions in the sidebar
- Click a session to switch between conversations
- Sessions are stored for up to 30 days

#### FAQ Tab

View frequently asked questions for the current textbook:

1. Navigate to the **"FAQ"** tab
2. Browse common questions and answers
3. Click a FAQ entry to load it into the chat
4. Report inappropriate FAQs using the report button

#### Practice Materials Tab

Generate AI-powered practice materials to test your knowledge:

**Generate Practice Materials:**
1. Navigate to the **"Practice"** tab
2. Enter a topic (e.g., "derivatives and integrals")
3. Select material type:
   - **MCQ** (Multiple Choice Questions)
   - **Flashcards**
   - **Short Answer**
4. Choose difficulty level (Beginner, Intermediate, Advanced)
5. Set the number of items to generate
6. Click **"Generate"** to create practice materials

**MCQ Practice:**
- Answer multiple choice questions
- View correct answers and explanations
- Track your progress

**Flashcard Practice:**
- Flip cards to reveal answers
- Mark cards as known or unknown
- Review difficult cards

**Short Answer Practice:**
- Submit written responses
- Click **"Grade My Answer"** for AI feedback
- View strengths and areas for improvement

**Export Practice Materials:**
- Click **"Export to PDF"** to download a printable version
- Click **"Export to H5P"** to create an LMS-compatible package

#### Shared Prompts Tab

Browse and use prompts shared by other users:

1. Navigate to the **"Shared Prompts"** tab
2. Filter by role (Student or Instructor)
3. Click a prompt to use it in your chat
4. Report inappropriate prompts using the report button

**Creating Shared Prompts:**
1. Click **"Create Prompt"** button
2. Enter a title and prompt text
3. Add tags for categorization
4. Set visibility (Private, Organization, Public)
5. Click **"Save"** to share with others

### Audio & Accessibility Settings

Configure audio narration for chat responses:

1. Click the **"Audio Settings"** icon in the sidebar
2. Toggle **"Narration"** on or off
3. Enable **"Autoplay"** to automatically read responses
4. Select narration mode:
   - **Both** (read all messages)
   - **AI only** (read only AI responses)
   - **User only** (read only user messages)
5. Choose a voice from available options
6. Adjust rate, pitch, and volume
7. Click **"Play Sample"** to test settings

---

## Instructor View

Instructors have access to additional features for creating educational materials.

### Switching to Instructor Mode

1. Click the **mode selector** in the top header
2. Select **"Instructor"** from the dropdown
3. The sidebar now includes a **"Material Editor"** link

### Material Editor

The Material Editor allows you to create and edit H5P-compatible practice materials:

**Creating Materials:**
1. Navigate to **"Material Editor"** in the sidebar
2. Generate practice materials using the Practice tab
3. Click **"Edit in Material Editor"** to customize

**Editing Questions:**
- Edit question text and options
- Add or remove answer choices
- Update explanations and feedback
- Reorder questions

**Exporting to H5P:**
1. Click **"Export to H5P"** button
2. A .zip file is generated and downloaded
3. Import the H5P package into your LMS (Canvas, Moodle, etc.)

**Exporting to PDF:**
1. Click **"Export to PDF"** button
2. A formatted PDF is generated and downloaded
3. Use for printing or sharing offline

---

## Troubleshooting

**Cannot log in:**
- Verify your email is confirmed
- Reset password if needed through the login page

**Textbooks not loading:**
- Refresh the page
- Check that the API endpoint is configured correctly
- Contact administrator if issue persists

**Chat not responding:**
- Check your internet connection
- Verify the textbook is properly ingested
- Try creating a new chat session

**Audio not working:**
- Ensure narration is enabled in audio settings
- Check browser permissions for audio playback
- Try a different voice option

**H5P export fails:**
- Verify the backend API is running
- Check browser console for error messages
- Contact administrator if issue persists

**Session expired:**
- Refresh the page to create a new session
- Log in again if prompted

---

## Best Practices

- Be specific with questions and include chapter or section references
- Use prompt templates for consistent, repeatable queries
- Share conversations responsibly (avoid sensitive information)
- Use practice materials regularly to reinforce learning
- Report inappropriate content to help maintain quality
- Export materials before sessions expire (30 days)

---

## Additional Resources

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- API Documentation: Available at your API Gateway endpoint
