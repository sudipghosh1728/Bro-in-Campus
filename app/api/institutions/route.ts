import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import rawInstitutions from "aishe-institutions-list/data/institutions.json";

type Institution = { aishe_code?: string; name: string; state: string; district?: string };
const institutions = rawInstitutions as Institution[];
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// This package is an MIT-licensed, preprocessed copy of the AISHE higher
// education directory. The direct JSON import lets Next trace the data for a
// production server while keeping all 70k+ records off the client.
function searchDirectory(query: string, limit = 20) {
  const words = normalize(query).split(" ").filter(Boolean);
  const code = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  const seen = new Set<string>();
  return institutions.filter((institution) => {
    const matchesWords = words.every((word) => normalize(institution.name).includes(word) || normalize(institution.state).includes(word) || normalize(institution.district ?? "").includes(word));
    const matchesCode = code.length > 0 && (institution.aishe_code ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(code);
    const matches = matchesWords || matchesCode;
    if (!matches) return false;
    const key = `${normalize(institution.name)}:${normalize(institution.state)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return ok({ institutions: [] });
    const results = searchDirectory(query, 20).map((institution) => ({
      aisheCode: institution.aishe_code ?? "",
      name: institution.name,
      state: institution.state,
      district: institution.district ?? null,
    }));
    return ok({ institutions: results });
  } catch (error) { return fail(error); }
}
