// Simulated security-review funnel for a fictional animal rescue.
// Verdicts are scripted. Token and time figures are made up.
(function () {
  const ORG = "Second Chance Paws Rescue";

  const POST = {
    author: "Dillon Mulroy",
    handle: "dillon_mulroy",
    url: "https://x.com/dillon_mulroy/status/2123761892787175459",
  };

  const PAGE = {
    url: "https://vercel.com/oss/deepsec",
    description: "an open-source security review harness",
  };

  const REPO = {
    url: "https://github.com/vercel-labs/deepsec",
  };

  const SURFACES = ["auth", "payments", "webhooks", "file/URL input", "admin"];

  const ESTIMATE = {
    shortlistTokensEach: 1400,
    shortlistSecondsEach: 18,
    wholeTokensEach: 4200,
    wholeSecondsEach: 28,
    regexSeconds: 3,
  };

  const FILES = [
    {
      id: "home",
      order: 1,
      path: "app/page.tsx",
      role: "Homepage with the rescue's name and the listed pets.",
      surface: null,
      surfaceWhy: "Not a security-sensitive surface. It does not handle auth, payments, webhooks, file or URL input, or admin data.",
      matcher: false,
      matcherWhy: "No local matcher hits. No secret-shaped string, no request URL passed to a network call, no raw HTML sink, no export, and no webhook.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. Matchers do not send this file, and the scripted agent would have nothing to flag if they did.",
      code: [
        "export default function Home() {",
        "  return (",
        "    <main>",
        "      <h1>Second Chance Paws Rescue</h1>",
        "      <p>Foster a dog or cat. Donate a month of food. Apply to adopt.</p>",
        "      <PetList />",
        "    </main>",
        "  );",
        "}",
      ].join("\n"),
    },
    {
      id: "footer",
      order: 2,
      path: "components/Footer.tsx",
      role: "Footer with the street address and two links.",
      surface: null,
      surfaceWhy: "Not a security-sensitive surface. The links are hardcoded paths on this site.",
      matcher: false,
      matcherWhy: "No local matcher hits. The address is public shelter text, not a credential.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. Nothing here takes a request.",
      code: [
        "export function Footer() {",
        "  return (",
        "    <footer>",
        "      <p>Second Chance Paws Rescue · 418 Maple Street</p>",
        "      <a href=\"/volunteer\">Volunteer</a>",
        "      <a href=\"/donate\">Donate</a>",
        "    </footer>",
        "  );",
        "}",
      ].join("\n"),
    },
    {
      id: "pet-card",
      order: 3,
      path: "components/PetCard.tsx",
      role: "Renders one pet's name, age, and species as text.",
      surface: null,
      surfaceWhy: "Not a security-sensitive surface. The values are rendered as text, not as HTML.",
      matcher: false,
      matcherWhy: "No local matcher hits.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. Text children are not an HTML sink.",
      code: [
        "export function PetCard({ pet }) {",
        "  return (",
        "    <article>",
        "      <h2>{pet.name}</h2>",
        "      <p>{pet.age} · {pet.species}</p>",
        "    </article>",
        "  );",
        "}",
      ].join("\n"),
    },
    {
      id: "donate-button",
      order: 4,
      path: "components/DonateButton.tsx",
      role: "A link to the donate page. No payment call.",
      surface: null,
      surfaceWhy: "Not a security-sensitive surface. The payment itself lives in routes/donate.ts.",
      matcher: false,
      matcherWhy: "No local matcher hits. This file never talks to the payment provider.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. A link is not a charge.",
      code: [
        "export function DonateButton() {",
        "  return <a href=\"/donate\">Donate a month of food</a>;",
        "}",
      ].join("\n"),
    },
    {
      id: "volunteer-form",
      order: 5,
      path: "components/VolunteerForm.tsx",
      role: "The volunteer sign-up form. It posts to the volunteer route.",
      surface: null,
      surfaceWhy: "Not a security-sensitive surface. The form is markup. The route that writes the row is routes/volunteer.ts.",
      matcher: false,
      matcherWhy: "No local matcher hits.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. There is no handler in this file.",
      code: [
        "export function VolunteerForm() {",
        "  return (",
        "    <form action=\"/api/volunteer\" method=\"post\">",
        "      <label>Email <input name=\"email\" type=\"email\" required /></label>",
        "      <label>Which days? <input name=\"days\" /></label>",
        "      <button type=\"submit\">Sign up</button>",
        "    </form>",
        "  );",
        "}",
      ].join("\n"),
    },
    {
      id: "format-date",
      order: 6,
      path: "utils/formatDate.ts",
      role: "Formats an ISO date for the foster calendar.",
      surface: null,
      surfaceWhy: "Not a security-sensitive surface. It formats a date and returns a string.",
      matcher: false,
      matcherWhy: "No local matcher hits.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. A date formatter has no trust boundary.",
      code: [
        "export function formatDate(iso) {",
        "  return new Intl.DateTimeFormat(\"en-US\", {",
        "    month: \"short\",",
        "    day: \"numeric\",",
        "    year: \"numeric\",",
        "  }).format(new Date(iso));",
        "}",
      ].join("\n"),
    },
    {
      id: "slug",
      order: 7,
      path: "utils/slug.ts",
      role: "Turns a pet name into a URL slug.",
      surface: null,
      surfaceWhy: "Not a security-sensitive surface. The slug is a label, not an authorization decision.",
      matcher: false,
      matcherWhy: "No local matcher hits.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding.",
      code: [
        "export function slug(name) {",
        "  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, \"-\");",
        "}",
      ].join("\n"),
    },
    {
      id: "db",
      order: 8,
      path: "lib/db.ts",
      role: "Opens the database pool from DATABASE_URL.",
      surface: null,
      surfaceWhy: "Not a security-sensitive surface by itself. It holds no request input. Callers decide which rows they may read.",
      matcher: false,
      matcherWhy: "No local matcher hits. The connection string is an environment variable name, not a copied secret.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. There is no query here.",
      code: [
        "import { Pool } from \"pg\";",
        "",
        "export const db = new Pool({",
        "  connectionString: process.env.DATABASE_URL,",
        "});",
      ].join("\n"),
    },
    {
      id: "pets",
      order: 9,
      path: "lib/pets.ts",
      role: "Lists pets marked as listed. Public columns only.",
      surface: null,
      surfaceWhy: "Not a security-sensitive surface. The query has no caller-supplied id and returns the public listing columns.",
      matcher: false,
      matcherWhy: "No local matcher hits. The SQL is a fixed statement.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. The statement does not concatenate input.",
      code: [
        "export async function listedPets() {",
        "  const { rows } = await db.query(",
        "    \"select id, name, age, species from pets where listed = true order by name\"",
        "  );",
        "  return rows;",
        "}",
      ].join("\n"),
    },
    {
      id: "login",
      order: 10,
      path: "routes/login.ts",
      role: "Checks a password hash and sets the session cookie.",
      surface: "auth",
      surfaceWhy: "Sign-in is on the auth surface. It accepts an email and a password.",
      matcher: false,
      matcherWhy: "Matchers leave it off the shortlist. The failure path returns 401, and the cookie is set with cookieOptions from lib/session.ts.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. The hash check has to fail closed, and in this file it does.",
      code: [
        "export async function POST(req) {",
        "  const { email, password } = await req.json();",
        "  const user = await findUserByEmail(email);",
        "  const ok = user && await checkPassword(password, user.passwordHash);",
        "  if (!ok) return new Response(\"Sign-in failed\", { status: 401 });",
        "  const token = await signSession(user.id);",
        "  return setCookie(\"scp_session\", token, cookieOptions);",
        "}",
      ].join("\n"),
    },
    {
      id: "session",
      order: 11,
      path: "lib/session.ts",
      role: "Reads the session cookie and defines the cookie flags.",
      surface: "auth",
      surfaceWhy: "Session parsing is on the auth surface. Other routes call readSession before they trust a user id.",
      matcher: false,
      matcherWhy: "Matchers leave it off the shortlist. The flags are set in this file, and nothing here looks like a leaked secret.",
      regex: null,
      regexMiss: "No danger-shaped pattern. The cookie name is ordinary.",
      finding: {
        id: "cookie-flags",
        rank: 9,
        scope: "unfiltered",
        title: "Session cookie flagged as readable from script",
        verdict: "false-positive",
        trace: "Agent saw a cookie named scp_session and assumed the flags were missing. It did not read cookieOptions.",
        revalidation: "Rejected. cookieOptions sets httpOnly, sameSite lax, and secure. routes/login.ts passes that object into setCookie.",
      },
      agentQuiet: "",
      code: [
        "export async function readSession(req) {",
        "  const token = req.cookies.get(\"scp_session\")?.value;",
        "  if (!token) return null;",
        "  return verifySessionToken(token);",
        "}",
        "",
        "export const cookieOptions = {",
        "  httpOnly: true,",
        "  sameSite: \"lax\",",
        "  secure: true,",
        "  path: \"/\",",
        "};",
      ].join("\n"),
    },
    {
      id: "volunteer",
      order: 12,
      path: "routes/volunteer.ts",
      role: "Saves a volunteer sign-up on the signed-in user.",
      surface: "auth",
      surfaceWhy: "The route writes a row tied to a person, so it is on the auth surface.",
      matcher: false,
      matcherWhy: "Matchers leave it off the shortlist. The insert stamps userId from requireSession, and the body is parsed by a schema.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. The write is bound to the session before the row is created.",
      code: [
        "export async function POST(req) {",
        "  const session = await requireSession(req);",
        "  const form = volunteerSchema.parse(await req.json());",
        "  await db.volunteer.create({",
        "    data: { email: form.email, days: form.days, userId: session.userId },",
        "  });",
        "  return Response.json({ ok: true });",
        "}",
      ].join("\n"),
    },
    {
      id: "adoption-new",
      order: 13,
      path: "routes/adoptions/new.ts",
      role: "Creates an application and stamps ownerId from the session.",
      surface: "auth",
      surfaceWhy: "Creating an adoption application is on the auth surface. The row holds a family's note and the pet they want.",
      matcher: false,
      matcherWhy: "Matchers leave it off the shortlist. The id comes from the database after the insert, not from the URL, and ownerId is the session user.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding. This is the write path that stores ownerId. The missing check is on the read path, routes/adoptions/[id].ts.",
      code: [
        "export async function POST(req) {",
        "  const session = await requireSession(req);",
        "  const form = adoptionSchema.parse(await req.json());",
        "  const row = await db.adoptionApplication.create({",
        "    data: {",
        "      petId: form.petId,",
        "      note: form.note,",
        "      ownerId: session.userId,",
        "    },",
        "  });",
        "  return Response.json({ id: row.id });",
        "}",
      ].join("\n"),
    },
    {
      id: "donate",
      order: 14,
      path: "routes/donate.ts",
      role: "Starts a checkout from a server-side price id.",
      surface: "payments",
      surfaceWhy: "Card checkout is on the payments surface.",
      matcher: false,
      matcherWhy: "Matchers leave it off the shortlist. The amount is not taken from the client, and there is no secret literal in the file.",
      regex: null,
      regexMiss: "No danger-shaped pattern. plan is a key into a table, which a regex does not follow.",
      finding: {
        id: "donate-amount",
        rank: 8,
        scope: "unfiltered",
        title: "Donation price flagged as client-controlled",
        verdict: "false-positive",
        trace: "Agent saw the browser send plan and assumed the charged price came from the client. It did not follow plan into PRICE_TABLE.",
        revalidation: "Rejected. plan only chooses a key in PRICE_TABLE. The price id is written in this file. An unknown plan is a 400. The amount never comes from the client.",
      },
      agentQuiet: "",
      code: [
        "const PRICE_TABLE = {",
        "  foster_month: \"price_foster_month\",",
        "  vet_visit: \"price_vet_visit\",",
        "};",
        "",
        "export async function POST(req) {",
        "  const { plan } = await req.json();",
        "  const price = PRICE_TABLE[plan];",
        "  if (!price) return new Response(\"Unknown plan\", { status: 400 });",
        "  const session = await stripe.checkout.sessions.create({",
        "    mode: \"payment\",",
        "    line_items: [{ price, quantity: 1 }],",
        "    success_url: origin + \"/thanks\",",
        "  });",
        "  return Response.json({ url: session.url });",
        "}",
      ].join("\n"),
    },
    {
      id: "middleware",
      order: 15,
      path: "middleware.ts",
      role: "Requires a staff session for paths under /admin.",
      surface: "auth",
      surfaceWhy: "The staff guard is on the auth surface.",
      matcher: false,
      matcherWhy: "Matchers leave it off the shortlist. This file is the check, not a sensitive action missing a check. The CSV export is mounted at /export, so this guard never sees it. That bug is on admin/export.ts.",
      regex: null,
      regexMiss: null,
      finding: null,
      agentQuiet: "No finding on this file. The gap is the path that never enters the guard.",
      code: [
        "export function middleware(req) {",
        "  if (req.nextUrl.pathname.startsWith(\"/admin\")) {",
        "    return requireStaff(req);",
        "  }",
        "  return NextResponse.next();",
        "}",
        "",
        "export const config = { matcher: [\"/admin/:path*\"] };",
      ].join("\n"),
    },
    {
      id: "adoption-read",
      order: 16,
      path: "routes/adoptions/[id].ts",
      role: "Loads one adoption application by the id in the URL.",
      surface: "auth",
      surfaceWhy: "Adoption applications hold a family's address and phone. Reading one is on the auth surface.",
      matcher: true,
      matcherWhy: "Local matcher: the route takes an id from the URL and loads an adoption application, which the surface map marks as private. That puts the file on the shortlist. It does not mean a pattern already found a bug.",
      regex: null,
      regexMiss: "No danger-shaped pattern. There is no raw HTML, no secret-shaped string, no fetch of a caller-supplied URL, and no webhook body. A findUnique by id is ordinary, so a regex pass reports nothing here.",
      finding: {
        id: "idor",
        rank: 1,
        scope: "shortlist",
        title: "Adoption application is readable by id alone",
        verdict: "confirmed",
        trace: "Agent traced request -> handler -> db query; no check that application.ownerId === session.userId.",
        revalidation: "Stands. The handler never reads the session. routes/adoptions/new.ts stores ownerId, so the column exists and this read ignores it. The response includes the family's address and phone.",
      },
      agentQuiet: "",
      code: [
        "export async function GET(req, { params }) {",
        "  const application = await db.adoptionApplication.findUnique({",
        "    where: { id: params.id },",
        "  });",
        "  if (!application) return new Response(\"Not found\", { status: 404 });",
        "  return Response.json(application);",
        "}",
      ].join("\n"),
    },
    {
      id: "webhook",
      order: 17,
      path: "lib/stripeWebhook.ts",
      role: "Handles the payment provider's webhook.",
      surface: "webhooks",
      surfaceWhy: "A payment webhook is its own surface. Anyone who can reach the URL can send a body.",
      matcher: true,
      matcherWhy: "Local matcher: the handler parses the body as JSON and never reads a signature header.",
      regex: "Pattern: a webhook route calls req.json and branches on event.type, and the file never mentions a signature.",
      regexMiss: null,
      finding: {
        id: "webhook-signature",
        rank: 3,
        scope: "shortlist",
        title: "Webhook does not check a signature",
        verdict: "confirmed",
        trace: "Agent traced request -> handler -> req.json() -> markDonationPaid. The body is trusted with no signature check.",
        revalidation: "Stands. No signature helper is called, and the route does not read a signature header. A forged POST can mark a donation paid.",
      },
      agentQuiet: "",
      code: [
        "export async function POST(req) {",
        "  const event = await req.json();",
        "  if (event.type === \"checkout.session.completed\") {",
        "    await markDonationPaid(event.data.object.id);",
        "  }",
        "  return new Response(\"ok\");",
        "}",
      ].join("\n"),
    },
    {
      id: "export",
      order: 18,
      path: "admin/export.ts",
      role: "Downloads every adoption application as a CSV.",
      surface: "admin",
      surfaceWhy: "A full export of family applications is on the admin surface.",
      matcher: true,
      matcherWhy: "Local matcher: the handler builds a CSV of adoption applications and never calls requireStaff or readSession.",
      regex: "Pattern: a response is labeled text/csv and the file never calls requireStaff or readSession.",
      regexMiss: null,
      finding: {
        id: "export-auth",
        rank: 2,
        scope: "shortlist",
        title: "CSV export has no auth check",
        verdict: "confirmed",
        trace: "Agent traced request -> handler -> findMany -> CSV response. No requireStaff, and no read of the session.",
        revalidation: "Stands. middleware.ts only guards paths under /admin, and the comment in this file says it is mounted at /export. The CSV contains names, phones, and addresses.",
      },
      agentQuiet: "",
      code: [
        "// Mounted at /export, next to the public site. Not under /admin.",
        "export async function GET() {",
        "  const rows = await db.adoptionApplication.findMany();",
        "  const csv = toCsv(rows);",
        "  return new Response(csv, {",
        "    headers: {",
        "      \"content-type\": \"text/csv\",",
        "      \"content-disposition\": \"attachment; filename=applications.csv\",",
        "    },",
        "  });",
        "}",
      ].join("\n"),
    },
    {
      id: "pet-photo",
      order: 19,
      path: "lib/fetchPetPhoto.ts",
      role: "Fetches a pet photo from a URL in the request.",
      surface: "file/URL input",
      surfaceWhy: "A URL supplied by the caller, which the server then requests, is file/URL input.",
      matcher: true,
      matcherWhy: "Local matcher: a network fetch is called with imageUrl from the JSON body.",
      regex: "Pattern: fetch is called with a value taken from the request body.",
      regexMiss: null,
      finding: {
        id: "ssrf",
        rank: 4,
        scope: "shortlist",
        title: "Server fetches a URL the caller picks",
        verdict: "confirmed",
        trace: "Agent traced request -> handler -> imageUrl -> fetch. The host comes from the caller.",
        revalidation: "Stands. There is no allowlist of hosts. The server will request whatever address the caller names, including hosts on the shelter's own network. This is the SSRF-shaped bug in the demo.",
      },
      agentQuiet: "",
      code: [
        "export async function POST(req) {",
        "  const { imageUrl } = await req.json();",
        "  const res = await fetch(imageUrl);",
        "  if (!res.ok) return new Response(\"Could not read that photo\", { status: 400 });",
        "  const bytes = await res.arrayBuffer();",
        "  return storePetPhoto(bytes);",
        "}",
      ].join("\n"),
    },
    {
      id: "pet-read",
      order: 20,
      path: "routes/pets/[id].ts",
      role: "Loads one listed pet by the id in the URL.",
      surface: "file/URL input",
      surfaceWhy: "The id comes from the URL, so the surface map files this under file/URL input. The row is the public listing.",
      matcher: true,
      matcherWhy: "Local matcher: a route loads a row by the id in the URL. The same selector that shortlisted the adoption application.",
      regex: null,
      regexMiss: "No danger-shaped pattern. A public read by id looks like the private one, and a regex pass does not flag either of them.",
      finding: {
        id: "pet-idor",
        rank: 5,
        scope: "shortlist",
        title: "Public pet page flagged as an IDOR",
        verdict: "false-positive",
        trace: "Agent traced request -> handler -> findUnique by params.id, saw the adoption route's shape, and called this an IDOR too.",
        revalidation: "Rejected. This table is the public listing. The response is name, age, species, and a blurb. There is no owner, phone, or home address. A pet with listed set to false is a 404.",
      },
      agentQuiet: "",
      code: [
        "export async function GET(_req, { params }) {",
        "  const pet = await db.pet.findUnique({ where: { id: params.id } });",
        "  if (!pet || !pet.listed) return new Response(\"Not found\", { status: 404 });",
        "  return Response.json({",
        "    name: pet.name,",
        "    age: pet.age,",
        "    species: pet.species,",
        "    blurb: pet.blurb,",
        "  });",
        "}",
      ].join("\n"),
    },
    {
      id: "foster-note",
      order: 21,
      path: "components/FosterNote.tsx",
      role: "Renders a volunteer's foster note as HTML.",
      surface: "file/URL input",
      surfaceWhy: "Volunteer-written notes are stored input that this component turns into HTML. The surface map counts that as file/URL input.",
      matcher: true,
      matcherWhy: "Local matcher: the file contains dangerouslySetInnerHTML.",
      regex: "Pattern: dangerouslySetInnerHTML appears in the file.",
      regexMiss: null,
      finding: {
        id: "xss",
        rank: 6,
        scope: "shortlist",
        title: "Foster note flagged as XSS",
        verdict: "false-positive",
        trace: "Agent saw dangerouslySetInnerHTML and stopped. It did not open sanitizeFosterNote.",
        revalidation: "Rejected. sanitizeFosterNote escapes ampersands first, then < and >, and only then wraps lines in p tags the function itself writes. The raw note is not the HTML.",
      },
      agentQuiet: "",
      code: [
        "export function FosterNote({ note }) {",
        "  const clean = sanitizeFosterNote(note);",
        "  return <div dangerouslySetInnerHTML={{ __html: clean }} />;",
        "}",
        "",
        "export function sanitizeFosterNote(note) {",
        "  const text = note",
        "    .replace(/&/g, \"&amp;\")",
        "    .replace(/</g, \"&lt;\")",
        "    .replace(/>/g, \"&gt;\");",
        "  return text.split(\"\\n\").map((line) => \"<p>\" + line + \"</p>\").join(\"\");",
        "}",
      ].join("\n"),
    },
    {
      id: "stripe-fixture",
      order: 22,
      path: "tests/fixtures/stripe.ts",
      role: "Test fixture for the webhook test. The key string is made up.",
      surface: "payments",
      surfaceWhy: "The surface map includes files that mention the payment provider, including this test fixture.",
      matcher: true,
      matcherWhy: "Local matcher: a string shaped like a secret key.",
      regex: "Pattern: a string shaped like a secret key.",
      regexMiss: null,
      finding: {
        id: "fixture-key",
        rank: 7,
        scope: "shortlist",
        title: "Test fixture flagged as a leaked key",
        verdict: "false-positive",
        trace: "Agent saw a string shaped like a secret key and flagged a hardcoded credential.",
        revalidation: "Rejected. The file lives in tests/fixtures and is imported only by the webhook test. The value uses the test-mode prefix and the words not_a_real_key. It is a fixture written for this demo, not a live credential.",
      },
      agentQuiet: "",
      code: [
        "// Used by webhook.test.ts. Not imported by a route.",
        "export const TEST_CHECKOUT = {",
        "  key: \"sk_test_secondChancePaws_not_a_real_key\",",
        "  price: \"price_foster_month\",",
        "  eventType: \"checkout.session.completed\",",
        "};",
      ].join("\n"),
    },
  ];

  function group(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function aboutTime(seconds) {
    if (seconds < 60) return "about " + seconds + " seconds";
    const minutes = Math.round(seconds / 60);
    const unit = minutes === 1 ? " minute" : " minutes";
    return "about " + minutes + unit;
  }

  function normalize(options) {
    const source = options || {};
    return {
      skipRevalidation: !!source.skipRevalidation,
      skipMatchers: !!source.skipMatchers,
      regexOnly: !!source.regexOnly,
    };
  }

  function activeFinding(file, opts) {
    if (!file.finding || opts.regexOnly) return null;
    if (file.finding.scope === "unfiltered") return opts.skipMatchers ? file.finding : null;
    return file.finding;
  }

  function statusOf(file, opts) {
    if (opts.regexOnly) {
      if (file.regex) {
        const real = file.finding && file.finding.verdict === "confirmed";
        return {
          badge: "Pattern hit",
          kind: real ? "bad" : "warn",
          inReport: true,
          key: real ? "pattern-real" : "pattern-fp",
        };
      }
      if (file.finding && file.finding.verdict === "confirmed") {
        return { badge: "Missed", kind: "miss", inReport: false, key: "missed" };
      }
      return { badge: "No finding", kind: "neutral", inReport: false, key: "none" };
    }
    const finding = activeFinding(file, opts);
    if (finding && finding.verdict === "confirmed") {
      return { badge: "Confirmed", kind: "bad", inReport: true, key: "confirmed" };
    }
    if (finding && finding.verdict === "false-positive") {
      if (opts.skipRevalidation) {
        return { badge: "False positive", kind: "warn", inReport: true, key: "fp" };
      }
      return { badge: "Dropped", kind: "ok", inReport: false, key: "dropped" };
    }
    return { badge: "No finding", kind: "neutral", inReport: false, key: "none" };
  }

  function inStage(file, stage, opts, status) {
    if (stage === "files") return true;
    if (stage === "surfaces") return !!file.surface;
    if (stage === "candidates") return opts.skipMatchers ? true : !!file.matcher;
    if (stage === "agent") return !!activeFinding(file, opts);
    if (stage === "report") return status.inReport;
    return false;
  }

  function headingFor(file, status) {
    if (!file.finding) return file.role;
    if (status.key === "none") return file.role;
    return file.finding.title;
  }

  function runLine(opts, status) {
    if (status.key === "confirmed") return "Confirmed. It is in the revalidated report.";
    if (status.key === "dropped") return "The agent flagged it. Revalidation dropped it, so it is not in the report.";
    if (status.key === "fp") return "False positive. Revalidation is off, so it stays in the report.";
    if (status.key === "pattern-real") return "Pattern hit. The full pipeline would keep this after revalidation. This mode does not run that check.";
    if (status.key === "pattern-fp") return "Pattern hit. The full pipeline would reject this. A regex pass cannot tell.";
    if (status.key === "missed") return "Missed. This is a real bug, and it is not in the pattern report.";
    if (opts.skipMatchers) return "Sent to the agent because matchers are skipped. No scripted finding on this file.";
    return "Not in the report.";
  }

  function agentLine(file, opts) {
    const trace = file.finding.trace;
    if (opts.regexOnly) {
      return "This mode does not call an agent. The scripted trace the full pipeline would use: " + trace;
    }
    if (file.finding.scope === "unfiltered" && !opts.skipMatchers) {
      return "Matchers do not send this file. The scripted trace, if every file were sent: " + trace;
    }
    return trace;
  }

  function revalLine(file, opts) {
    const text = file.finding.revalidation;
    if (opts.regexOnly) return "This mode does not revalidate. The full pipeline would say: " + text;
    if (opts.skipRevalidation && activeFinding(file, opts)) return "Skipped. If it had run: " + text;
    return text;
  }

  function linesFor(file, opts, status) {
    const lines = [
      { label: "In this run", text: runLine(opts, status) },
      { label: "File", text: file.role },
      {
        label: "Surface",
        text: file.surface ? file.surface + ". " + file.surfaceWhy : file.surfaceWhy,
      },
      { label: "Matcher", text: file.matcherWhy },
    ];
    if (file.regex) lines.push({ label: "Regex", text: file.regex });
    else if (file.regexMiss) lines.push({ label: "Regex", text: file.regexMiss });
    if (file.finding) {
      lines.push({ label: "Agent", text: agentLine(file, opts) });
      lines.push({ label: "Revalidation", text: revalLine(file, opts) });
    } else {
      lines.push({ label: "Agent", text: file.agentQuiet });
    }
    return lines;
  }

  function cardFor(file, opts) {
    const status = statusOf(file, opts);
    return {
      id: file.id,
      order: file.order,
      rank: file.finding ? file.finding.rank : 100 + file.order,
      path: file.path,
      heading: headingFor(file, status),
      badge: status.badge,
      kind: status.kind,
      statusKey: status.key,
      code: file.code,
      lines: linesFor(file, opts, status),
    };
  }

  function sorter(stageId) {
    return function (a, b) {
      if (stageId === "files" || stageId === "surfaces") return a.order - b.order;
      return a.rank - b.rank || a.order - b.order;
    };
  }

  function surfaceLegend() {
    return SURFACES.map(function (name) {
      const count = FILES.filter(function (file) { return file.surface === name; }).length;
      return name + " " + count;
    }).join(" · ");
  }

  function reportTitle(opts) {
    if (opts.regexOnly) return "Pattern report";
    if (opts.skipRevalidation) return "Unvalidated report";
    return "Revalidated";
  }

  function reportHint(opts) {
    if (opts.regexOnly) return "Pattern hits stand in for the report. Revalidation did not run.";
    if (opts.skipRevalidation) return "The agent's list, with nothing removed.";
    return "Findings that still stood after a second pass.";
  }

  function summary(opts, counts) {
    if (opts.regexOnly && opts.skipMatchers && opts.skipRevalidation) {
      return "Regex only, pointed at every file, with revalidation off. Those extra switches do not add an agent. The report is " + counts.report + " pattern hits, " + counts.falsePositives + " of them false positives, and the adoption-application IDOR is still missing.";
    }
    if (opts.regexOnly && opts.skipMatchers) {
      return "Regex only, pointed at every file. Scanning more files does not create the agent trace. The report is " + counts.report + " pattern hits, and the adoption-application IDOR is still missing, because nothing on that handler pattern-looks dangerous.";
    }
    if (opts.regexOnly && opts.skipRevalidation) {
      return "Regex only, and revalidation is off. Revalidation was not going to run in this mode. The report is " + counts.report + " pattern hits. The adoption-application IDOR is missing, and the hits that only look bad stay in.";
    }
    if (opts.regexOnly) {
      return "Regex matchers only, no agent. The report is " + counts.report + " pattern hits. It mixes real bugs with lines that only look dangerous, and it misses the adoption-application IDOR. That handler is an ordinary findUnique. The logic bug needs the agent to trace the path.";
    }
    if (opts.skipMatchers && opts.skipRevalidation) {
      return "False positives flood the report. All " + counts.files + " files go to the agent, revalidation is off, and " + counts.falsePositives + " of the " + counts.report + " findings are false positives. Two of them are files the shortlist would have skipped. The made-up token estimate is the large one.";
    }
    if (opts.skipMatchers) {
      return "Matchers are skipped, so all " + counts.files + " files go to the agent. The agent writes " + counts.agent + " findings. Revalidation still keeps " + counts.report + ", the same confirmed bugs as the shortlist. The extra files add false positives that revalidation removes, and they balloon the made-up estimate.";
    }
    if (opts.skipRevalidation) {
      return "False positives flood the report. The agent sees the " + counts.candidates + " matcher candidates and writes " + counts.agent + " findings. Revalidation is off, so all " + counts.report + " stay, including " + counts.falsePositives + " false positives: the public pet page, the sanitized foster note, and the test-fixture key.";
    }
    return "Local matchers send " + counts.candidates + " of " + counts.surfaces + " surfaces to the agent. The agent writes " + counts.agent + " findings. Revalidation keeps " + counts.report + " and drops the false positives.";
  }

  function costFor(opts) {
    const shortlistFiles = FILES.filter(function (file) { return file.matcher; }).length;
    const shortlist = {
      id: "shortlist",
      title: "Matcher shortlist",
      files: shortlistFiles,
      tokens: shortlistFiles * ESTIMATE.shortlistTokensEach,
      seconds: shortlistFiles * ESTIMATE.shortlistSecondsEach,
    };
    const whole = {
      id: "whole",
      title: "Every file to the agent",
      files: FILES.length,
      tokens: FILES.length * ESTIMATE.wholeTokensEach,
      seconds: FILES.length * ESTIMATE.wholeSecondsEach,
    };
    const regex = {
      id: "regex",
      title: "Regex pass, no agent",
      files: 0,
      tokens: 0,
      seconds: ESTIMATE.regexSeconds,
    };
    let active = "shortlist";
    if (opts.regexOnly) active = "regex";
    else if (opts.skipMatchers) active = "whole";
    const cards = [shortlist, whole, regex].map(function (card) {
      const sent = card.id === "regex" ? " sent to an agent" : " sent to the agent";
      const fileWord = card.files === 1 ? " file" : " files";
      return {
        id: card.id,
        title: card.title,
        files: card.files,
        tokens: card.tokens,
        seconds: card.seconds,
        active: card.id === active,
        figure: card.tokens === 0 ? "no model tokens" : "about " + group(card.tokens) + " tokens",
        detail: aboutTime(card.seconds) + " · " + card.files + fileWord + sent,
      };
    });
    return {
      madeUp: true,
      active: active,
      cards: cards,
      formula: "Made-up illustrative estimate, not a deepsec measurement and not a bill. The shortlist pretends " + group(ESTIMATE.shortlistTokensEach) + " tokens and " + ESTIMATE.shortlistSecondsEach + " seconds a file. Sending every file pretends " + group(ESTIMATE.wholeTokensEach) + " tokens and " + ESTIMATE.wholeSecondsEach + " seconds a file, as if the agent also opened imports. A regex pass pretends no model tokens and about " + ESTIMATE.regexSeconds + " seconds.",
    };
  }

  function run(options) {
    const opts = normalize(options);
    const countsBase = {
      files: FILES.length,
      surfaces: FILES.filter(function (file) { return file.surface; }).length,
      candidates: opts.skipMatchers ? FILES.length : FILES.filter(function (file) { return file.matcher; }).length,
      agent: FILES.filter(function (file) { return activeFinding(file, opts); }).length,
    };
    const reportFiles = FILES.filter(function (file) { return statusOf(file, opts).inReport; });
    const counts = {
      files: countsBase.files,
      surfaces: countsBase.surfaces,
      candidates: countsBase.candidates,
      agent: opts.regexOnly ? 0 : countsBase.agent,
      report: reportFiles.length,
      falsePositives: reportFiles.filter(function (file) { return statusOf(file, opts).kind === "warn"; }).length,
    };
    const stages = [
      {
        id: "files",
        kicker: "Start",
        title: "All files",
        count: counts.files,
        skipped: false,
        hint: "Every file in the mini repo.",
        empty: "",
      },
      {
        id: "surfaces",
        kicker: "1",
        title: "Surfaces",
        count: counts.surfaces,
        skipped: false,
        hint: "Auth, payments, webhooks, file/URL input, and admin.",
        empty: "",
      },
      {
        id: "candidates",
        kicker: "2",
        title: "Matcher candidates",
        count: counts.candidates,
        skipped: false,
        hint: opts.skipMatchers ? "Matchers are off. Every file is sent on." : "Local matchers keep a shortlist from the surfaces.",
        empty: "",
      },
      {
        id: "agent",
        kicker: "3",
        title: "Agent findings",
        count: counts.agent,
        skipped: opts.regexOnly,
        hint: opts.regexOnly ? "Skipped. This mode never calls an agent." : "Scripted traces through the files the agent was given.",
        empty: opts.regexOnly ? "The agent is skipped. Regex mode never sends a file to a model. Open the pattern report to see what the patterns kept." : "",
      },
      {
        id: "report",
        kicker: "4",
        title: reportTitle(opts),
        count: counts.report,
        skipped: false,
        hint: reportHint(opts),
        empty: "",
      },
    ];
    const cards = {};
    stages.forEach(function (stage) {
      cards[stage.id] = FILES.filter(function (file) {
        return inStage(file, stage.id, opts, statusOf(file, opts));
      }).map(function (file) {
        return cardFor(file, opts);
      }).sort(sorter(stage.id));
    });
    const missed = opts.regexOnly ? FILES.filter(function (file) { return statusOf(file, opts).key === "missed"; }) : [];
    const gotcha = missed.length === 0 ? null : {
      title: "The ownership bug is not in this report",
      text: "routes/adoptions/[id].ts loads an application by the id in the URL and never checks application.ownerId === session.userId. Nothing on the handler pattern-looks dangerous, so a regex pass stays quiet. The logic bug needs the agent to trace the path.",
      files: missed.map(function (file) {
        return { id: file.id, path: file.path, code: file.code };
      }),
    };
    return {
      options: opts,
      counts: counts,
      stages: stages,
      cards: cards,
      summary: summary(opts, counts),
      gotcha: gotcha,
      cost: costFor(opts),
      surfaceLegend: surfaceLegend(),
    };
  }

  const api = {
    ORG: ORG,
    POST: POST,
    PAGE: PAGE,
    REPO: REPO,
    SURFACES: SURFACES,
    ESTIMATE: ESTIMATE,
    FILES: FILES,
    run: run,
  };

  if (typeof globalThis !== "undefined") globalThis.Funnel = api;
})();
