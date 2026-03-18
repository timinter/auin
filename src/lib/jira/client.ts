/**
 * Jira Cloud REST API client for fetching worklog data.
 *
 * Requires env vars: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
 * Uses Basic auth (email:apiToken) per Atlassian Cloud API.
 */

interface JiraWorklog {
  timeSpentSeconds: number;
  author: {
    emailAddress: string;
    accountId: string;
  };
  started: string;
}

interface JiraSearchResult {
  issues: Array<{
    key: string;
    fields: {
      worklog: {
        total: number;
        worklogs: JiraWorklog[];
      };
    };
  }>;
  total: number;
  startAt: number;
  maxResults: number;
}

function getJiraConfig() {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    auth: Buffer.from(`${email}:${apiToken}`).toString("base64"),
  };
}

async function jiraFetch<T>(path: string): Promise<T> {
  const config = getJiraConfig();
  if (!config) throw new Error("Jira not configured");

  const res = await fetch(`${config.baseUrl}${path}`, {
    headers: {
      Authorization: `Basic ${config.auth}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Jira API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch total hours logged by a user (identified by email) in a date range.
 * Returns null if Jira is not configured.
 *
 * Uses JQL to find issues with worklogs in the date range, then sums
 * worklog time for the specific user.
 */
export async function fetchUserWorklogHours(
  userEmail: string,
  startDate: string,
  endDate: string
): Promise<number | null> {
  const config = getJiraConfig();
  if (!config) return null;

  // JQL: find issues that had worklogs updated in the date range
  const jql = `worklogDate >= "${startDate}" AND worklogDate <= "${endDate}" AND worklogAuthor = "${userEmail}"`;
  const encodedJql = encodeURIComponent(jql);

  let totalSeconds = 0;
  let startAt = 0;
  const maxResults = 50;

  // Paginate through all matching issues
  while (true) {
    const result = await jiraFetch<JiraSearchResult>(
      `/rest/api/3/search?jql=${encodedJql}&fields=worklog&startAt=${startAt}&maxResults=${maxResults}`
    );

    for (const issue of result.issues) {
      const worklogs = issue.fields.worklog.worklogs;

      // If the issue has more worklogs than returned inline, fetch them separately
      if (issue.fields.worklog.total > worklogs.length) {
        const allWorklogs = await fetchAllWorklogs(issue.key);
        totalSeconds += sumUserWorklogs(allWorklogs, userEmail, startDate, endDate);
      } else {
        totalSeconds += sumUserWorklogs(worklogs, userEmail, startDate, endDate);
      }
    }

    if (startAt + result.issues.length >= result.total) break;
    startAt += maxResults;
  }

  return Math.round((totalSeconds / 3600) * 100) / 100;
}

/**
 * Fetch all worklogs for a specific issue (handles pagination).
 */
async function fetchAllWorklogs(issueKey: string): Promise<JiraWorklog[]> {
  const allWorklogs: JiraWorklog[] = [];
  let startAt = 0;
  const maxResults = 1000;

  while (true) {
    const result = await jiraFetch<{ worklogs: JiraWorklog[]; total: number }>(
      `/rest/api/3/issue/${issueKey}/worklog?startAt=${startAt}&maxResults=${maxResults}`
    );

    allWorklogs.push(...result.worklogs);
    if (startAt + result.worklogs.length >= result.total) break;
    startAt += maxResults;
  }

  return allWorklogs;
}

/**
 * Sum worklog seconds for a specific user within a date range.
 */
function sumUserWorklogs(
  worklogs: JiraWorklog[],
  userEmail: string,
  startDate: string,
  endDate: string
): number {
  return worklogs
    .filter((w) => {
      if (w.author.emailAddress !== userEmail) return false;
      const date = w.started.split("T")[0];
      return date >= startDate && date <= endDate;
    })
    .reduce((sum, w) => sum + w.timeSpentSeconds, 0);
}
