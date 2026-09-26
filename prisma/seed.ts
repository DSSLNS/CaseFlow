/**
 * Seeds realistic SAMPLE data for the demo state. Running it wipes existing data.
 * Usage: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

type Step = [action: string, expected: string];
type SeedCase = {
  title: string;
  suite: string;
  priority: string;
  status: string;
  type: string;
  severity?: string;
  assignee?: string;
  preconditions?: string;
  description?: string;
  tags?: string[];
  estimate?: number;
  automation?: string;
  automationRef?: string;
  steps: Step[];
};

async function wipe() {
  await db.testExecution.deleteMany();
  await db.testRunCase.deleteMany();
  await db.testRun.deleteMany();
  await db.importRowResult.deleteMany();
  await db.importBatch.deleteMany();
  await db.attachment.deleteMany();
  await db.testCaseTag.deleteMany();
  await db.tag.deleteMany();
  await db.testStep.deleteMany();
  await db.testCase.deleteMany();
  // Delete suites leaf-first (parent relation is Restrict).
  for (;;) {
    const suites = await db.suite.findMany({ select: { id: true, parentId: true } });
    if (!suites.length) break;
    const parents = new Set(suites.map((s) => s.parentId).filter(Boolean));
    await db.suite.deleteMany({ where: { id: { in: suites.filter((s) => !parents.has(s.id)).map((s) => s.id) } } });
  }
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

async function main() {
  await wipe();

  // All seed users share the password "Password1" (meet policy: upper+lower+digit, 8+ chars)
  const seedPasswordHash = await bcrypt.hash("Password1", 12);

  const users = await Promise.all(
    [
      ["Priya Sharma", "priya.sharma@example.com", "QA Lead"],
      ["Alex Chen", "alex.chen@example.com", "Software Developer"],
      ["Maria Garcia", "maria.garcia@example.com", "QA Engineer"],
      ["Sam Okafor", "sam.okafor@example.com", "QA Engineer"],
    ].map(([name, email, jobTitle]) =>
      db.user.create({ data: { name, email, passwordHash: seedPasswordHash, jobTitle, role: "member" } }),
    ),
  );
  const userByName = new Map(users.map((u) => [u.name.split(" ")[0], u]));

  async function makeProject(name: string, code: string, description: string, suiteTree: Record<string, string[]>, cases: SeedCase[]) {
    const project = await db.project.create({ data: { name, code, description, isSample: true } });
    // Add all seed users as members (first user = owner)
    for (const [i, u] of users.entries()) {
      await db.projectMember.create({
        data: { projectId: project.id, userId: u.id, role: i === 0 ? "owner" : "member" },
      });
    }
    const suiteIds = new Map<string, string>();
    let pos = 0;
    for (const [parent, children] of Object.entries(suiteTree)) {
      const p = await db.suite.create({ data: { projectId: project.id, name: parent, position: pos++ } });
      suiteIds.set(parent, p.id);
      let cpos = 0;
      for (const child of children) {
        const c = await db.suite.create({ data: { projectId: project.id, parentId: p.id, name: child, position: cpos++ } });
        suiteIds.set(`${parent} > ${child}`, c.id);
      }
    }
    const created = [];
    let number = 0;
    for (const sc of cases) {
      number++;
      const author = users[number % users.length];
      const updatedAt = new Date(Date.now() - (cases.length - number) * 1000 * 60 * 60 * 7);
      const tc = await db.testCase.create({
        data: {
          projectId: project.id,
          number,
          suiteId: suiteIds.get(sc.suite)!,
          title: sc.title,
          description: sc.description ?? "",
          preconditions: sc.preconditions ?? "",
          priority: sc.priority,
          status: sc.status,
          type: sc.type,
          severity: sc.severity ?? null,
          assigneeId: sc.assignee ? userByName.get(sc.assignee)!.id : null,
          estimateMinutes: sc.estimate ?? null,
          automationStatus: sc.automation ?? "Not Automated",
          automationRef: sc.automationRef ?? "",
          createdById: author.id,
          updatedById: author.id,
          createdAt: new Date(updatedAt.getTime() - 1000 * 60 * 60 * 24 * 10),
          updatedAt,
          steps: { create: sc.steps.map(([action, expectedResult], i) => ({ position: i, action, expectedResult })) },
        },
      });
      for (const tagName of sc.tags ?? []) {
        const tag = await db.tag.upsert({
          where: { projectId_name: { projectId: project.id, name: tagName } },
          update: {},
          create: { projectId: project.id, name: tagName },
        });
        await db.testCaseTag.create({ data: { testCaseId: tc.id, tagId: tag.id } });
      }
      created.push({ ...tc, steps: sc.steps, suitePath: sc.suite });
    }
    await db.project.update({ where: { id: project.id }, data: { caseCounter: number } });
    return { project, cases: created };
  }

  const web = await makeProject(
    "Web Storefront",
    "WEB",
    "Customer-facing e-commerce web application (sample data).",
    {
      Authentication: ["Login", "Password Reset"],
      Checkout: ["Cart", "Payments"],
      Search: [],
      "User Profile": [],
    },
    [
      { title: "Login with valid email and password", suite: "Authentication > Login", priority: "Critical", status: "Ready", type: "Smoke", severity: "Blocker", assignee: "Priya", preconditions: "A registered, verified user account exists.", tags: ["auth", "smoke"], estimate: 5, automation: "Automated", automationRef: "e2e/auth/login.spec.ts", steps: [["Open the /login page", "Login form is displayed"], ["Enter a valid email and password", "Fields accept input; password is masked"], ["Click Sign in", "User is redirected to the account dashboard"]] },
      { title: "Login fails with wrong password", suite: "Authentication > Login", priority: "High", status: "Ready", type: "Functional", severity: "Critical", assignee: "Priya", preconditions: "A registered user account exists.", tags: ["auth", "negative"], estimate: 5, automation: "Automated", automationRef: "e2e/auth/login.spec.ts", steps: [["Open the /login page", "Login form is displayed"], ["Enter a valid email and an incorrect password", ""], ["Click Sign in", "Error 'Email or password is incorrect' is shown; user stays on /login"]] },
      { title: "Account locks after 5 failed attempts", suite: "Authentication > Login", priority: "High", status: "Ready", type: "Security", severity: "Critical", assignee: "Sam", tags: ["auth", "security"], estimate: 10, automation: "To Automate", steps: [["Attempt to sign in with a wrong password 5 times", "Each attempt shows an error"], ["Attempt a 6th sign in with the correct password", "Account is locked and a lockout message with unlock instructions is shown"]] },
      { title: "Remember me keeps the session after browser restart", suite: "Authentication > Login", priority: "Medium", status: "Draft", type: "Functional", assignee: "Alex", tags: ["auth"], estimate: 10, steps: [["Sign in with 'Remember me' checked", "User is signed in"], ["Close and reopen the browser, then open the site", "User is still signed in"]] },
      { title: "Request password reset email", suite: "Authentication > Password Reset", priority: "High", status: "Ready", type: "Functional", severity: "Major", assignee: "Maria", preconditions: "User has access to the registered mailbox.", tags: ["auth", "email"], estimate: 10, steps: [["Click 'Forgot password?' on the login page", "Reset form is displayed"], ["Submit the registered email", "Confirmation message is shown"], ["Open the mailbox", "Reset email arrives within 2 minutes with a single-use link"]] },
      { title: "Reset link expires after 1 hour", suite: "Authentication > Password Reset", priority: "Medium", status: "Ready", type: "Security", assignee: "Sam", tags: ["auth", "security"], estimate: 15, steps: [["Request a reset link and wait more than 1 hour", ""], ["Open the reset link", "Page states the link has expired and offers to send a new one"]] },
      { title: "Add product to cart from product page", suite: "Checkout > Cart", priority: "Critical", status: "Ready", type: "Smoke", severity: "Blocker", assignee: "Alex", tags: ["cart", "smoke"], estimate: 5, automation: "Automated", automationRef: "e2e/cart/add.spec.ts", steps: [["Open any in-stock product page", "Add to cart button is enabled"], ["Click Add to cart", "Cart badge increments by 1 and a confirmation appears"]] },
      { title: "Update item quantity in cart", suite: "Checkout > Cart", priority: "High", status: "Ready", type: "Functional", assignee: "Alex", tags: ["cart"], estimate: 5, automation: "Automated", automationRef: "e2e/cart/quantity.spec.ts", steps: [["Open the cart with one item", "Item is listed with quantity 1"], ["Change quantity to 3", "Line total and cart subtotal update immediately"]] },
      { title: "Remove item from cart", suite: "Checkout > Cart", priority: "Medium", status: "Ready", type: "Regression", assignee: "Maria", tags: ["cart"], estimate: 5, steps: [["Open the cart with two items", ""], ["Click Remove on the first item", "Item is removed and totals recalculate"]] },
      { title: "Cart persists for signed-in users across devices", suite: "Checkout > Cart", priority: "Medium", status: "Draft", type: "Integration", tags: ["cart", "sync"], estimate: 20, steps: [["Add an item to the cart on desktop while signed in", ""], ["Sign in on a mobile browser", "The same item is in the cart"]] },
      { title: "Pay with a valid credit card", suite: "Checkout > Payments", priority: "Critical", status: "Ready", type: "Smoke", severity: "Blocker", assignee: "Priya", preconditions: "Payment gateway sandbox is configured. Cart contains at least one item.", tags: ["payments", "smoke"], estimate: 10, automation: "Automated", automationRef: "e2e/checkout/card.spec.ts", steps: [["Proceed to checkout and enter shipping details", "Payment step is shown"], ["Enter test card 4242 4242 4242 4242, any future expiry, CVC 123", "Card is accepted"], ["Click Place order", "Order confirmation page shows an order number"]] },
      { title: "Declined card shows a clear error", suite: "Checkout > Payments", priority: "High", status: "Ready", type: "Functional", severity: "Major", assignee: "Priya", tags: ["payments", "negative"], estimate: 10, steps: [["Enter the sandbox 'card declined' number at the payment step", ""], ["Click Place order", "Error 'Your card was declined' is shown and no order is created"]] },
      { title: "Apply a valid discount code", suite: "Checkout > Payments", priority: "Medium", status: "Ready", type: "Functional", assignee: "Maria", tags: ["payments", "promo"], estimate: 5, steps: [["Enter code SAVE10 in the discount field", ""], ["Click Apply", "10% discount line appears and total is reduced"]] },
      { title: "Checkout API returns 400 for an empty cart", suite: "Checkout > Payments", priority: "Medium", status: "Ready", type: "API", assignee: "Sam", tags: ["api", "payments"], estimate: 5, automation: "Automated", automationRef: "api/checkout.test.ts::empty-cart", steps: [["POST /api/checkout with an empty cart id", "Response is 400 with error code CART_EMPTY"]] },
      { title: "Search returns relevant results for a product name", suite: "Search", priority: "High", status: "Ready", type: "Functional", assignee: "Alex", tags: ["search"], estimate: 5, automation: "Automated", automationRef: "e2e/search/basic.spec.ts", steps: [["Type 'running shoes' into the search box and press Enter", "Results page lists running shoes first"]] },
      { title: "Search with no results shows suggestions", suite: "Search", priority: "Low", status: "Ready", type: "UI", assignee: "Maria", tags: ["search"], estimate: 5, steps: [["Search for 'qwxzv'", "'No results' message and popular categories are shown"]] },
      { title: "Search results load in under 1 second", suite: "Search", priority: "Medium", status: "Draft", type: "Performance", tags: ["search", "perf"], estimate: 30, steps: [["Run 50 searches with common terms and record response times", "p95 response time is below 1000 ms"]] },
      { title: "Search input is protected against XSS", suite: "Search", priority: "High", status: "Ready", type: "Security", severity: "Critical", assignee: "Sam", tags: ["search", "security"], estimate: 10, steps: [["Search for <script>alert(1)</script>", "Query is shown as plain text; no script executes"]] },
      { title: "Update profile name and phone", suite: "User Profile", priority: "Medium", status: "Ready", type: "Functional", assignee: "Maria", tags: ["profile"], estimate: 5, steps: [["Open Account > Profile", "Current details are shown"], ["Change the name and phone number, then Save", "Success message; new values persist after reload"]] },
      { title: "Upload an avatar image", suite: "User Profile", priority: "Low", status: "Ready", type: "UI", assignee: "Alex", tags: ["profile"], estimate: 5, steps: [["Click Change avatar and choose a 1 MB PNG", "Preview is shown"], ["Click Save", "Avatar updates in the header"]] },
      { title: "Legacy order history page (old layout)", suite: "User Profile", priority: "Low", status: "Deprecated", type: "Regression", tags: ["profile", "legacy"], steps: [["Open /account/orders-legacy", "Old order history layout renders"]] },
    ],
  );

  const mob = await makeProject(
    "Mobile App",
    "MOB",
    "iOS and Android shopping app (sample data).",
    { Onboarding: [], Notifications: [] },
    [
      { title: "First launch shows onboarding carousel", suite: "Onboarding", priority: "High", status: "Ready", type: "UI", assignee: "Alex", steps: [["Install and open the app", "Three onboarding slides are shown"], ["Swipe through all slides", "Get started button appears on the last slide"]] },
      { title: "Skip onboarding goes to home screen", suite: "Onboarding", priority: "Medium", status: "Ready", type: "Functional", steps: [["Tap Skip on the first slide", "Home screen is shown"]] },
      { title: "Push notification opens the related order", suite: "Notifications", priority: "High", status: "Draft", type: "Integration", assignee: "Sam", steps: [["Trigger an 'order shipped' push", "Notification is received"], ["Tap the notification", "Order details screen opens"]] },
    ],
  );

  // Runs: one completed regression run and one in-progress smoke run.
  async function makeRun(project: typeof web.project, cases: typeof web.cases, title: string, owner: string, results: string[], completed: boolean, daysAgo: number, meta: { environment: string; buildVersion: string; releaseRef: string; sourceSuites: string }) {
    const createdAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
    const run = await db.testRun.create({
      data: {
        projectId: project.id,
        title,
        description: "Sample run.",
        ...meta,
        executionDate: createdAt,
        ownerId: userByName.get(owner)!.id,
        createdById: userByName.get(owner)!.id,
        status: completed ? "Completed" : "Active",
        createdAt,
        completedAt: completed ? new Date(createdAt.getTime() + 6 * 3600 * 1000) : null,
      },
    });
    for (const [i, c] of cases.entries()) {
      const status = results[i] ?? "Not Run";
      const executed = status !== "Not Run";
      const executor = users[i % users.length];
      const rc = await db.testRunCase.create({
        data: {
          runId: run.id,
          testCaseId: c.id,
          position: i,
          caseKey: `${project.code}-${c.number}`,
          title: c.title,
          suiteName: c.suitePath,
          priority: c.priority,
          preconditions: c.preconditions,
          stepsSnapshot: JSON.stringify(c.steps.map(([action, expectedResult]) => ({ action, expectedResult }))),
          status,
          comment: status === "Fail" ? "Error message did not appear." : "",
          bugRef: status === "Fail" ? "BUG-1042" : "",
          executedById: executed ? executor.id : null,
          executedAt: executed ? new Date(createdAt.getTime() + (i + 1) * 600000) : null,
        },
      });
      if (executed) {
        await db.testExecution.create({
          data: {
            runCaseId: rc.id,
            status,
            comment: rc.comment,
            bugRef: rc.bugRef,
            executedById: executor.id,
            createdAt: rc.executedAt!,
            evidence:
              status === "Fail"
                ? { create: [{ kind: "screenshot", label: "Missing error message", url: "https://example.com/evidence/bug-1042.png", createdById: executor.id }] }
                : undefined,
          },
        });
      }
    }
  }

  const readyWeb = web.cases.filter((c) => c.status === "Ready");
  await makeRun(web.project, readyWeb, "Release 2.3 Regression", "Priya",
    readyWeb.map((_, i) => (i === 1 ? "Fail" : i === 6 ? "Blocked" : "Pass")), true, 9,
    { environment: "Staging", buildVersion: "2.3.0 (build 418)", releaseRef: "REL-2.3", sourceSuites: "All active cases" });
  const smoke = web.cases.filter((c) => c.type === "Smoke");
  await makeRun(web.project, smoke, "Sprint 18 Smoke", "Alex", ["Pass", "Pass"], false, 1,
    { environment: "QA", buildVersion: "2.4.0-rc.1", releaseRef: "SPRINT-18", sourceSuites: "" });

  console.log(`Seeded ${users.length} users, projects ${web.project.code} (${web.cases.length} cases) and ${mob.project.code} (${mob.cases.length} cases).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
