import { Fragment, useState } from "react";
import {
  buildYaml,
  type CVData,
  type Education,
  type Experience,
  type Language,
  type Skill,
} from "./yamlBuilder";

const API_URL = import.meta.env.PUBLIC_API_URL ?? "";

const STEPS = ["Personal", "Perfil", "Experiencia", "Educación", "Habilidades", "Descargar"];

const iCls =
  "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-700/50 w-full transition-colors";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-400 mb-1.5 block">
        {label}
        {required && <span className="text-blue-600/70 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function newExp(): Experience {
  return {
    id: crypto.randomUUID(),
    company: "",
    position: "",
    startDate: "",
    endDate: "present",
    location: "",
    highlights: "",
  };
}
function newEdu(): Education {
  return {
    id: crypto.randomUUID(),
    institution: "",
    area: "",
    degree: "",
    startDate: "",
    endDate: "present",
    location: "",
  };
}
function newSkill(): Skill {
  return { id: crypto.randomUUID(), label: "", details: "" };
}
function newLang(): Language {
  return { id: crypto.randomUUID(), label: "", details: "" };
}

export default function CVBuilder() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGithub, setShowGithub] = useState(false);

  const [personal, setPersonal] = useState({
    name: "",
    headline: "",
    location: "",
    email: "",
    phone: "",
    linkedin: "",
    github: "",
  });
  const [summary, setSummary] = useState("");
  const [experiences, setExperiences] = useState<Experience[]>([newExp()]);
  const [educations, setEducations] = useState<Education[]>([newEdu()]);
  const [skills, setSkills] = useState<Skill[]>([newSkill()]);
  const [languages, setLanguages] = useState<Language[]>([
    { id: crypto.randomUUID(), label: "Español", details: "Nativo" },
  ]);

  function updateExp(id: string, patch: Partial<Experience>) {
    setExperiences((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function updateEdu(id: string, patch: Partial<Education>) {
    setEducations((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function updateSkill(id: string, patch: Partial<Skill>) {
    setSkills((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function updateLang(id: string, patch: Partial<Language>) {
    setLanguages((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const data: CVData = {
        personal,
        summary,
        experience: experiences,
        education: educations,
        skills,
        languages,
      };
      const yaml = buildYaml(data);
      const res = await fetch(`${API_URL}/cv/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml_content: yaml }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${personal.name.replace(/\s+/g, "_") || "cv"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    // 0 — Personal
    <div key="personal" className="space-y-4">
      <p className="text-xs text-gray-500">Datos que aparecen en el encabezado del CV</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre completo" required>
          <input
            className={iCls}
            value={personal.name}
            onChange={(e) => setPersonal({ ...personal, name: e.target.value })}
            placeholder="Juan Pérez"
          />
        </Field>
        <Field label="Título profesional">
          <input
            className={iCls}
            value={personal.headline}
            onChange={(e) => setPersonal({ ...personal, headline: e.target.value })}
            placeholder="Contador · Enfermera · Vendedora · Técnico"
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Ubicación">
          <input
            className={iCls}
            value={personal.location}
            onChange={(e) => setPersonal({ ...personal, location: e.target.value })}
            placeholder="Santiago, Chile"
          />
        </Field>
        <Field label="Email" required>
          <input
            className={iCls}
            type="email"
            value={personal.email}
            onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
            placeholder="juan@email.com"
          />
        </Field>
        <Field label="Teléfono">
          <input
            className={iCls}
            value={personal.phone}
            onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
            placeholder="+56 9 1234 5678"
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="LinkedIn (solo el usuario)">
          <input
            className={iCls}
            value={personal.linkedin}
            onChange={(e) => setPersonal({ ...personal, linkedin: e.target.value })}
            placeholder="juan-perez"
          />
        </Field>
        <div className="block">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-gray-400">GitHub</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                className="w-3 h-3 accent-blue-600"
                checked={showGithub}
                onChange={(e) => {
                  setShowGithub(e.target.checked);
                  if (!e.target.checked) setPersonal({ ...personal, github: "" });
                }}
              />
              <span className="text-xs text-gray-600">tengo GitHub</span>
            </label>
          </div>
          {showGithub ? (
            <input
              className={iCls}
              value={personal.github}
              onChange={(e) => setPersonal({ ...personal, github: e.target.value })}
              placeholder="juanperez"
            />
          ) : (
            <div className="text-xs text-gray-600 h-9 flex items-center px-3 border border-white/5 rounded-lg bg-white/2">
              solo para desarrolladores
            </div>
          )}
        </div>
      </div>
    </div>,

    // 1 — Perfil
    <div key="perfil" className="space-y-4">
      <p className="text-xs text-gray-500">Resumen profesional — aparece como primera sección del CV</p>
      <Field label="Perfil">
        <textarea
          className={`${iCls} resize-none`}
          rows={7}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Profesional con X años de experiencia en... Destaco por mi capacidad de..."
        />
      </Field>
    </div>,

    // 2 — Experiencia
    <div key="exp" className="space-y-4">
      <p className="text-xs text-gray-500">Experiencia laboral en orden cronológico inverso</p>
      {experiences.map((exp, i) => (
        <div key={exp.id} className="border border-white/8 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Experiencia {i + 1}</span>
            {experiences.length > 1 && (
              <button
                onClick={() => setExperiences((es) => es.filter((e) => e.id !== exp.id))}
                className="text-xs text-red-400/50 hover:text-red-400 transition-colors"
              >
                Eliminar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Empresa" required>
              <input
                className={iCls}
                value={exp.company}
                onChange={(e) => updateExp(exp.id, { company: e.target.value })}
                placeholder="Empresa S.A."
              />
            </Field>
            <Field label="Cargo" required>
              <input
                className={iCls}
                value={exp.position}
                onChange={(e) => updateExp(exp.id, { position: e.target.value })}
                placeholder="Vendedora · Técnico · Enfermera · Cajero"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Ubicación">
              <input
                className={iCls}
                value={exp.location}
                onChange={(e) => updateExp(exp.id, { location: e.target.value })}
                placeholder="Santiago"
              />
            </Field>
            <Field label="Inicio">
              <input
                className={`${iCls} [color-scheme:dark]`}
                type="month"
                value={exp.startDate}
                onChange={(e) => updateExp(exp.id, { startDate: e.target.value })}
              />
            </Field>
            <Field label="Término">
              {exp.endDate === "present" ? (
                <div className="flex items-center gap-2 h-9 mt-0.5">
                  <span className="text-xs text-blue-600">Actualmente aquí</span>
                  <button
                    onClick={() => updateExp(exp.id, { endDate: "" })}
                    className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    cambiar
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <input
                    className={`${iCls} [color-scheme:dark]`}
                    type="month"
                    value={exp.endDate}
                    onChange={(e) => updateExp(exp.id, { endDate: e.target.value })}
                  />
                  <button
                    onClick={() => updateExp(exp.id, { endDate: "present" })}
                    className="text-xs text-gray-600 hover:text-blue-600 transition-colors whitespace-nowrap"
                  >
                    actual
                  </button>
                </div>
              )}
            </Field>
          </div>
          <Field label="Logros — una línea por punto (markdown soportado)">
            <textarea
              className={`${iCls} resize-none`}
              rows={3}
              value={exp.highlights}
              onChange={(e) => updateExp(exp.id, { highlights: e.target.value })}
              placeholder={"Atendí X clientes diarios superando la meta mensual en Y%\nCapacité a N personas nuevas en el proceso de Z"}
            />
          </Field>
        </div>
      ))}
      <button
        onClick={() => setExperiences((es) => [...es, newExp()])}
        className="text-xs text-blue-600 hover:text-blue-400 transition-colors"
      >
        + Agregar experiencia
      </button>
    </div>,

    // 3 — Educación
    <div key="edu" className="space-y-4">
      <p className="text-xs text-gray-500">Estudios formales y certificaciones</p>
      {educations.map((edu, i) => (
        <div key={edu.id} className="border border-white/8 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Estudio {i + 1}</span>
            {educations.length > 1 && (
              <button
                onClick={() => setEducations((es) => es.filter((e) => e.id !== edu.id))}
                className="text-xs text-red-400/50 hover:text-red-400 transition-colors"
              >
                Eliminar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Institución" required>
              <input
                className={iCls}
                value={edu.institution}
                onChange={(e) => updateEdu(edu.id, { institution: e.target.value })}
                placeholder="Universidad de Chile"
              />
            </Field>
            <Field label="Área / Carrera">
              <input
                className={iCls}
                value={edu.area}
                onChange={(e) => updateEdu(edu.id, { area: e.target.value })}
                placeholder="Administración · Enfermería · Contabilidad · Electricidad"
              />
            </Field>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Título">
              <input
                className={iCls}
                value={edu.degree}
                onChange={(e) => updateEdu(edu.id, { degree: e.target.value })}
                placeholder="Lic. · Ing. · Téc. · E.U."
              />
            </Field>
            <Field label="Ubicación">
              <input
                className={iCls}
                value={edu.location}
                onChange={(e) => updateEdu(edu.id, { location: e.target.value })}
                placeholder="Santiago"
              />
            </Field>
            <Field label="Inicio">
              <input
                className={`${iCls} [color-scheme:dark]`}
                type="month"
                value={edu.startDate}
                onChange={(e) => updateEdu(edu.id, { startDate: e.target.value })}
              />
            </Field>
            <Field label="Término">
              {edu.endDate === "present" ? (
                <div className="flex items-center gap-2 h-9 mt-0.5">
                  <span className="text-xs text-blue-600">Cursando</span>
                  <button
                    onClick={() => updateEdu(edu.id, { endDate: "" })}
                    className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    cambiar
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <input
                    className={`${iCls} [color-scheme:dark]`}
                    type="month"
                    value={edu.endDate}
                    onChange={(e) => updateEdu(edu.id, { endDate: e.target.value })}
                  />
                  <button
                    onClick={() => updateEdu(edu.id, { endDate: "present" })}
                    className="text-xs text-gray-600 hover:text-blue-600 transition-colors whitespace-nowrap"
                  >
                    cursando
                  </button>
                </div>
              )}
            </Field>
          </div>
        </div>
      ))}
      <button
        onClick={() => setEducations((es) => [...es, newEdu()])}
        className="text-xs text-blue-600 hover:text-blue-400 transition-colors"
      >
        + Agregar educación
      </button>
    </div>,

    // 4 — Habilidades
    <div key="skills" className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Habilidades</span>
          <span className="text-xs text-gray-600">Categoría · Detalle</span>
        </div>
        {skills.map((s) => (
          <div key={s.id} className="flex gap-3 items-center">
            <input
              className={`${iCls} flex-1`}
              value={s.label}
              onChange={(e) => updateSkill(s.id, { label: e.target.value })}
              placeholder="Herramientas · Técnicas · Equipos"
            />
            <input
              className={`${iCls} flex-[2]`}
              value={s.details}
              onChange={(e) => updateSkill(s.id, { details: e.target.value })}
              placeholder="Excel, Word, SAP · Soldadura MIG, TIG · Manejo de caja"
            />
            {skills.length > 1 && (
              <button
                onClick={() => setSkills((ss) => ss.filter((sk) => sk.id !== s.id))}
                className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setSkills((ss) => [...ss, newSkill()])}
          className="text-xs text-blue-600 hover:text-blue-400 transition-colors"
        >
          + Agregar habilidad
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Idiomas</span>
          <span className="text-xs text-gray-600">Idioma · Nivel</span>
        </div>
        {languages.map((l) => (
          <div key={l.id} className="flex gap-3 items-center">
            <input
              className={`${iCls} flex-1`}
              value={l.label}
              onChange={(e) => updateLang(l.id, { label: e.target.value })}
              placeholder="Inglés"
            />
            <input
              className={`${iCls} flex-[2]`}
              value={l.details}
              onChange={(e) => updateLang(l.id, { details: e.target.value })}
              placeholder="Intermedio"
            />
            {languages.length > 1 && (
              <button
                onClick={() => setLanguages((ls) => ls.filter((lg) => lg.id !== l.id))}
                className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setLanguages((ls) => [...ls, newLang()])}
          className="text-xs text-blue-600 hover:text-blue-400 transition-colors"
        >
          + Agregar idioma
        </button>
      </div>
    </div>,

    // 5 — Descargar
    <div key="download" className="space-y-6">
      <p className="text-xs text-gray-500">Revisa el resumen y descarga tu CV en PDF</p>
      <div className="border border-white/8 rounded-lg p-4 space-y-2">
        <div className="text-white font-medium">{personal.name || "(sin nombre)"}</div>
        {personal.headline && <div className="text-sm text-gray-400">{personal.headline}</div>}
        <div className="flex gap-4 text-xs text-gray-600 pt-1">
          <span>{experiences.filter((e) => e.company).length} experiencias</span>
          <span>{educations.filter((e) => e.institution).length} estudios</span>
          <span>{skills.filter((s) => s.label).length} habilidades</span>
          <span>{languages.filter((l) => l.label).length} idiomas</span>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2.5">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading || !personal.name || !personal.email}
        className="w-full py-3 rounded-lg bg-blue-800 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
      >
        {loading ? "Generando PDF..." : "Descargar PDF"}
      </button>

      <p className="text-xs text-gray-600 text-center">
        El PDF se genera en el servidor · gratis · sin guardar datos
      </p>
    </div>,
  ];

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-start">
        {STEPS.map((s, i) => (
          <Fragment key={s}>
            {i > 0 && (
              <div
                className={`flex-1 h-px mt-3.5 mx-1 transition-colors ${i <= step ? "bg-blue-800/40" : "bg-white/8"}`}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => i < step && setStep(i)}
                className={`w-7 h-7 rounded-full text-xs flex items-center justify-center transition-colors ${
                  i === step
                    ? "bg-blue-800 text-white"
                    : i < step
                      ? "bg-blue-800/30 text-blue-600 cursor-pointer hover:bg-blue-800/50"
                      : "bg-white/8 text-gray-600 cursor-default"
                }`}
              >
                {i + 1}
              </button>
              <span
                className={`text-[10px] hidden sm:block transition-colors ${i === step ? "text-blue-400" : "text-gray-600"}`}
              >
                {s}
              </span>
            </div>
          </Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-64">{steps[step]}</div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-2 border-t border-white/8">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="text-sm text-gray-400 hover:text-white disabled:opacity-0 transition-colors"
        >
          ← Anterior
        </button>
        {step < STEPS.length - 1 && (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 0 && !personal.name}
            className="text-sm text-blue-600 hover:text-blue-400 disabled:opacity-40 transition-colors"
          >
            Siguiente →
          </button>
        )}
      </div>
    </div>
  );
}
