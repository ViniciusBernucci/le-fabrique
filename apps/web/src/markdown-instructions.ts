import { markdownInstructionsFilenameSchema } from "@le-fabrique/contracts";

export async function readMarkdownInstructions(file: File, maxCharacters: number) {
  if (!markdownInstructionsFilenameSchema.safeParse(file.name).success)
    throw new Error("Selecione um arquivo com extensão .md e nome de até 200 caracteres.");
  // UTF-8 uses at most four bytes per character. Bound allocation before reading.
  if (file.size > maxCharacters * 4)
    throw new Error(
      `O arquivo deve conter até ${maxCharacters.toLocaleString("pt-BR")} caracteres.`,
    );
  let instructions: string;
  try {
    instructions = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new Error("Não foi possível ler o arquivo. Use Markdown em UTF-8.");
  }
  if (!instructions.trim() || instructions.includes("\0"))
    throw new Error("O arquivo deve conter instruções em texto Markdown.");
  if (instructions.length > maxCharacters)
    throw new Error(
      `O arquivo deve conter até ${maxCharacters.toLocaleString("pt-BR")} caracteres.`,
    );
  return { instructions, instructionsFilename: file.name };
}
