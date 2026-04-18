// GitHub Contents API client

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPO = process.env.GITHUB_REPO!;
const GITHUB_API = "https://api.github.com";

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: "file" | "dir";
  content?: string;
  encoding?: string;
}

export interface GitHubDirectory {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  type: "dir";
}

async function githubFetch(endpoint: string): Promise<any> {
  const url = `${GITHUB_API}/repos/${GITHUB_REPO}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Fanvue-Ops-Dashboard",
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
  }

  return response.json();
}

export async function getFileContent(path: string): Promise<string> {
  const data = await githubFetch(`/contents/${path}`);
  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  if (typeof data.content === "string") {
    return data.content;
  }
  return JSON.stringify(data, null, 2);
}

export async function listDirectory(path: string = ""): Promise<GitHubFile[]> {
  const endpoint = path ? `/contents/${path}` : "/contents";
  return githubFetch(endpoint);
}

export async function getHandoffContent(): Promise<string> {
  return getFileContent("handoff.md");
}

export async function getTasksContent(): Promise<string> {
  return getFileContent("TASKS.md");
}

export async function getDashboardContent(): Promise<string> {
  return getFileContent("DASHBOARD.md");
}

export async function listOutputFiles(): Promise<GitHubFile[]> {
  try {
    const contents = await listDirectory("output");
    return contents.filter((f: GitHubFile) => f.type === "file");
  } catch {
    return [];
  }
}

export async function getOutputFile(filename: string): Promise<string> {
  return getFileContent(`output/${filename}`);
}

export async function getRepoTree(): Promise<GitHubFile[]> {
  return listDirectory("");
}
