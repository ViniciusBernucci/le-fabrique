import {
  adminSessionSchema,
  type CreateProject,
  type CreateTicket,
  type FactorySettings,
  factorySettingsSchema,
  type Project,
  projectListSchema,
  projectSchema,
  type Ticket,
  ticketListSchema,
  ticketSchema,
  type UpdateFactorySettings,
} from "@le-fabrique/contracts";

const apiUrl = import.meta.env.VITE_API_URL ?? "/api";

async function request(path: string, token: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!response.ok)
    throw new Error(response.status === 401 ? "Credencial inválida" : "Operação não concluída");
  return response.json();
}

export async function authenticate(token: string): Promise<void> {
  adminSessionSchema.parse(await request("/auth/session", token));
}
export async function listProjects(token: string): Promise<Project[]> {
  return projectListSchema.parse(await request("/projects", token));
}
export async function createProject(token: string, input: CreateProject): Promise<Project> {
  return projectSchema.parse(
    await request("/projects", token, { method: "POST", body: JSON.stringify(input) }),
  );
}
export async function listTickets(token: string, projectId: string): Promise<Ticket[]> {
  return ticketListSchema.parse(await request(`/projects/${projectId}/tickets`, token));
}
export async function createTicket(
  token: string,
  projectId: string,
  input: CreateTicket,
): Promise<Ticket> {
  return ticketSchema.parse(
    await request(`/projects/${projectId}/tickets`, token, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
export async function markTicketReady(token: string, ticket: Ticket): Promise<Ticket> {
  return ticketSchema.parse(
    await request(`/tickets/${ticket.id}/ready`, token, {
      method: "POST",
      body: JSON.stringify({ expectedVersion: ticket.version }),
    }),
  );
}

export async function getFactorySettings(token: string): Promise<FactorySettings> {
  return factorySettingsSchema.parse(await request("/settings", token));
}

export async function updateFactorySettings(
  token: string,
  input: UpdateFactorySettings,
): Promise<FactorySettings> {
  return factorySettingsSchema.parse(
    await request("/settings", token, { method: "PUT", body: JSON.stringify(input) }),
  );
}
