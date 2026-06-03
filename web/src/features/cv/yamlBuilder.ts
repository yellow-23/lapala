export interface PersonalInfo {
  name: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
}

export interface Experience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string; // "YYYY-MM" or "present"
  location: string;
  highlights: string; // newline-separated
}

export interface Education {
  id: string;
  institution: string;
  area: string;
  degree: string;
  startDate: string;
  endDate: string;
  location: string;
}

export interface Skill {
  id: string;
  label: string;
  details: string;
}

export interface Language {
  id: string;
  label: string;
  details: string;
}

export interface CVData {
  personal: PersonalInfo;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  languages: Language[];
}

function q(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildYaml(data: CVData): string {
  const lines: string[] = [];

  lines.push("cv:");
  lines.push(`  name: ${q(data.personal.name)}`);
  if (data.personal.headline) lines.push(`  headline: ${q(data.personal.headline)}`);
  if (data.personal.location) lines.push(`  location: ${q(data.personal.location)}`);
  if (data.personal.email?.includes("@")) lines.push(`  email: ${q(data.personal.email)}`);
  const phoneDigits = data.personal.phone.replace(/\D/g, "");
  if (phoneDigits.length >= 8) lines.push(`  phone: ${q(data.personal.phone)}`);

  const socials: { network: string; username: string }[] = [];
  if (data.personal.linkedin) socials.push({ network: "LinkedIn", username: data.personal.linkedin });
  if (data.personal.github) socials.push({ network: "GitHub", username: data.personal.github });
  if (socials.length > 0) {
    lines.push("  social_networks:");
    for (const s of socials) {
      lines.push(`    - network: ${s.network}`);
      lines.push(`      username: ${q(s.username)}`);
    }
  }

  lines.push("  sections:");

  if (data.summary.trim()) {
    lines.push("    perfil:");
    lines.push(`      - ${q(data.summary.trim())}`);
  }

  const validExp = data.experience.filter((e) => e.company && e.position);
  if (validExp.length > 0) {
    lines.push("    experiencia:");
    for (const exp of validExp) {
      lines.push(`      - company: ${q(exp.company)}`);
      lines.push(`        position: ${q(exp.position)}`);
      if (exp.startDate) lines.push(`        start_date: ${q(exp.startDate)}`);
      if (exp.endDate) {
        if (exp.endDate === "present") lines.push("        end_date: present");
        else lines.push(`        end_date: ${q(exp.endDate)}`);
      }
      if (exp.location) lines.push(`        location: ${q(exp.location)}`);
      const highlights = exp.highlights
        .split("\n")
        .map((h) => h.trim())
        .filter(Boolean);
      if (highlights.length > 0) {
        lines.push("        highlights:");
        for (const h of highlights) lines.push(`          - ${q(h)}`);
      }
    }
  }

  const validEdu = data.education.filter((e) => e.institution);
  if (validEdu.length > 0) {
    lines.push("    educación:");
    for (const edu of validEdu) {
      lines.push(`      - institution: ${q(edu.institution)}`);
      if (edu.area) lines.push(`        area: ${q(edu.area)}`);
      if (edu.degree) lines.push(`        degree: ${q(edu.degree)}`);
      if (edu.startDate) lines.push(`        start_date: ${q(edu.startDate)}`);
      if (edu.endDate) {
        if (edu.endDate === "present") lines.push("        end_date: present");
        else lines.push(`        end_date: ${q(edu.endDate)}`);
      }
      if (edu.location) lines.push(`        location: ${q(edu.location)}`);
    }
  }

  const validSkills = data.skills.filter((s) => s.label && s.details);
  if (validSkills.length > 0) {
    lines.push("    habilidades:");
    for (const s of validSkills) {
      lines.push(`      - label: ${q(s.label)}`);
      lines.push(`        details: ${q(s.details)}`);
    }
  }

  const validLangs = data.languages.filter((l) => l.label && l.details);
  if (validLangs.length > 0) {
    lines.push("    idiomas:");
    for (const l of validLangs) {
      lines.push(`      - label: ${q(l.label)}`);
      lines.push(`        details: ${q(l.details)}`);
    }
  }

  lines.push("design:");
  lines.push("  theme: classic");
  lines.push("locale:");
  lines.push("  language: spanish");
  lines.push("  present: Presente");
  lines.push("  month_abbreviations: [Ene, Feb, Mar, Abr, May, Jun, Jul, Ago, Sep, Oct, Nov, Dic]");
  lines.push(
    "  month_names: [Enero, Febrero, Marzo, Abril, Mayo, Junio, Julio, Agosto, Septiembre, Octubre, Noviembre, Diciembre]"
  );

  return lines.join("\n");
}
