export default function PrivacyPolicyPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-semibold text-foreground">Privacy Policy</h1>
      <p className="text-sm text-text-muted">Last updated: May 10, 2026</p>

      <div className="space-y-4 text-sm leading-6 text-foreground/90">
        <p>
          We collect account and profile details (such as display name, form level, avatar, and contribution activity) to operate
          platform features like profiles, resources, forks, and notifications.
        </p>
        <p>
          We use this information to provide core functionality, improve product quality, and maintain community safety. We do not
          sell personal data to third parties.
        </p>
        <p>
          Content you publish, including uploaded resources and forks, may be visible to other users depending on feature context.
          Please avoid sharing sensitive personal information in public content.
        </p>
        <p>
          You may request profile updates or account removal through support channels. We may retain limited records where required
          by law, safety, or abuse-prevention obligations.
        </p>
      </div>
    </section>
  );
}
