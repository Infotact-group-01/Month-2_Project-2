const fs = require("fs");
const { sendAlert } = require("./emailService");

const report = JSON.parse(
    fs.readFileSync("./security-reports/semgrep-results.json")
);

const critical = report.results.filter(
    r => r.extra.severity === "ERROR"
);

if (critical.length > 0) {

    sendAlert(
        "🚨 Critical Security Alert",
        `
        <h2>Critical Vulnerabilities Found</h2>

        <p>Total: ${critical.length}</p>

        <ul>

        ${critical.map(v => `
            <li>
            ${v.path}<br>
            ${v.check_id}
            </li>
        `).join("")}

        </ul>
        `
    );

}
