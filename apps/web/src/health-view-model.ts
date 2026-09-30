import type { ReadinessResponse } from "@le-fabrique/contracts";

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; data: ReadinessResponse }
  | { status: "failed" };

interface StatusLabel {
  title: string;
  detail: string;
  tone: "neutral" | "success" | "danger";
}

export function readinessLabel(state: LoadState): StatusLabel {
  if (state.status === "loading") {
    return { title: "Verificando serviços", detail: "Aguarde um instante.", tone: "neutral" };
  }
  if (state.status === "failed" || state.data.status === "error") {
    return {
      title: "Dependência indisponível",
      detail: "Confira a API, o PostgreSQL e o Redis.",
      tone: "danger",
    };
  }
  return {
    title: "Fundação operacional",
    detail: "API, PostgreSQL e Redis respondendo.",
    tone: "success",
  };
}
