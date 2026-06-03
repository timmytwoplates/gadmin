export function Help() {
  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">Help</h1>
      </div>

      <div className="help-content">
        <section className="help-section">
          <h2>What is GADmin?</h2>
          <p>
            GADmin is the tool we use to set up and remove employee Google Workspace accounts.
            It automates the commands that used to be built manually in a spreadsheet, so every
            admin follows the exact same steps every time.
          </p>
        </section>

        <section className="help-section">
          <h2>Onboarding a New Employee</h2>
          <ol>
            <li>Click <strong>Onboard</strong> in the top nav.</li>
            <li>Fill in the employee's first name, last name, domain, and org unit.</li>
            <li>The app will show you a preview of their email address (e.g. <code>natalie.petersen@example.com</code>).</li>
            <li>Optionally fill in their email group, job title, password, and their manager's email.</li>
            <li>Click <strong>Preview Commands</strong> to see exactly what will run — review these before proceeding.</li>
            <li>Click <strong>Run All</strong> to execute. Each step shows a green checkmark on success or a red X with details on failure.</li>
          </ol>
          <p className="help-note">
            The account info (email and temporary password) is automatically emailed to the manager if you filled that field in.
          </p>
        </section>

        <section className="help-section">
          <h2>Offboarding a Departing Employee</h2>
          <ol>
            <li>Click <strong>Offboard</strong> in the top nav.</li>
            <li>Enter the employee's name and their full work email address.</li>
            <li>Confirm where to forward their email (defaults to <code>support@example.com</code>).</li>
            <li>Click <strong>Preview Commands</strong> — review carefully.</li>
            <li>Click <strong>Run All</strong>. You will be asked to confirm before anything runs.</li>
          </ol>
          <p className="help-note">
            Offboarding will: set an out-of-office reply, forward incoming email, transfer their Drive files, reset their password, remove them from all groups, and revoke all active sessions.
          </p>
        </section>

        <section className="help-section">
          <h2>History</h2>
          <p>
            The <strong>History</strong> page shows every employee that has been onboarded or offboarded
            through this app. Click <strong>View</strong> on any row to see the full list of commands that
            ran, including output and any errors.
          </p>
        </section>

        <section className="help-section">
          <h2>Admin</h2>
          <p>The <strong>Admin</strong> page has three tabs:</p>
          <ul>
            <li><strong>GAM Setup</strong> — check whether GAM is installed and authenticated. If it's not set up, follow the steps shown here.</li>
            <li><strong>Settings</strong> — change defaults like the forward-to email, calendar IDs, company name, and more. Changes take effect immediately.</li>
            <li><strong>Audit Log</strong> — a record of every change made through this app.</li>
          </ul>
        </section>

        <section className="help-section">
          <h2>Common Questions</h2>
          <dl className="faq">
            <dt>The GAM status says "Not Installed." What do I do?</dt>
            <dd>Go to Admin → GAM Setup and follow the instructions to download and install GAMADV-XTD3.</dd>

            <dt>GAM is installed but says "Not Authenticated."</dt>
            <dd>Open a terminal, run <code>C:\GAM7\gam.exe oauth create</code>, and follow the browser prompts. Then refresh the status.</dd>

            <dt>A step failed with a red X. What now?</dt>
            <dd>Click <strong>History</strong>, find the employee, click View, and read the error message next to the failed step. Most errors are either a wrong email address or a GAM authentication issue.</dd>

            <dt>I need to change the default forward-to email.</dt>
            <dd>Go to Admin → Settings and update the <code>forward_to</code> value.</dd>

            <dt>Who do I contact for help?</dt>
            <dd>Reach out to Tim at <a href="mailto:admin@example.com">admin@example.com</a>.</dd>
          </dl>
        </section>
      </div>
    </main>
  )
}
