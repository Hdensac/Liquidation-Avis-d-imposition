"use server";

import { createClient } from "@/utils/supabase/server";
import { buildLiquidationCalculations } from "@/utils/liquidationCalculations";
import { buildTpsCalculations } from "@/utils/tpsCalculations";

export interface TaxpayerItem {
  id: string;
  ifu: string;
  name: string;
  phone: string;
  commune: string;
  communes: string[];
  totalProperties: number;
  totalActivities: number;
  totalLiquidations: number;
  totalAmountDues: number;
  totalPaid: number;
  balanceDue: number;
  status: "A_JOUR" | "SOLDE_DEBITEUR";
  lastOperationDate: string;
}

export interface TaxpayerDetail {
  ifu: string;
  name: string;
  phone: string;
  commune: string;
  communes: string[];
  arrondissement: string;
  quartier: string;
  properties: Array<{
    id: string;
    typeBien: string;
    commune: string;
    arrondissement: string;
    quartier: string;
    superficie: number;
    superficieImposable: number;
    valeurLocative: number;
    isLoue?: boolean;
    description?: string;
    referenceLiq: string;
    created_at: string;
  }>;
  activities: Array<{
    id: string;
    activite: string;
    commune: string;
    arrondissement: string;
    quartier: string;
    montantAutresActivites: number;
    referenceTps: string;
    created_at: string;
  }>;
  liquidations: Array<{
    id: string;
    type: "TFU" | "TPS";
    reference: string;
    commune: string;
    startYear: number;
    totalDroits: number;
    status: string;
    created_at: string;
    description: string;
  }>;
  totalLiquidated: number;
  totalPaid: number;
  balanceDue: number;
}

/**
 * Normalise une chaîne pour la recherche/regroupement
 */
function normalizeKey(str: string): string {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]/gi, "");
}

class DisjointSet {
  parent = new Map<string, string>();

  find(i: string): string {
    if (!this.parent.has(i)) {
      this.parent.set(i, i);
      return i;
    }
    const p = this.parent.get(i)!;
    if (p === i) return i;
    const root = this.find(p);
    this.parent.set(i, root);
    return root;
  }

  union(i: string, j: string) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent.set(rootI, rootJ);
    }
  }
}

/**
 * Récupère la liste agrégrée de tous les contribuables (TFU & TPS)
 */
export async function fetchTaxpayers(searchQuery = "", page = 1, pageSize = 20): Promise<{
  data: TaxpayerItem[];
  total: number;
  totalUpToDate: number;
  totalDebtors: number;
  totalArrears: number;
  page: number;
  pageSize: number;
}> {
  const supabase = await createClient();

  // 1. Récupérer toutes les liquidations TFU avec leurs contribuables
  const { data: tfuData, error: tfuError } = await supabase
    .from("liquidations")
    .select(`
      id,
      status,
      commune,
      arrondissement,
      quartier,
      reference_liq,
      created_at,
      type_bien,
      superficie,
      superficie_imposable,
      valeur_locative,
      start_year,
      is_loue,
      valeur_irf,
      description,
      contribuable:contribuables (
        id,
        nom_prenoms,
        ifu_npi,
        telephone
      )
    `)
    .order("created_at", { ascending: false });

  if (tfuError) {
    console.error("Error fetching TFU liquidations for taxpayers:", tfuError);
  }

  // 2. Récupérer toutes les liquidations TPS
  const { data: tpsData, error: tpsError } = await supabase
    .from("tps_liquidations")
    .select(`
      id,
      status,
      commune,
      arrondissement,
      quartier,
      reference_tps,
      created_at,
      activite,
      montant_autres_activites,
      acomptes_payes,
      start_year,
      contribuable:tps_contribuables (
        id,
        nom_raison_sociale,
        ifu_nc,
        telephone
      )
    `)
    .order("created_at", { ascending: false });

  if (tpsError) {
    console.error("Error fetching TPS liquidations for taxpayers:", tpsError);
  }

  // Construction du graphe d'équivalence (DisjointSet)
  const dsu = new DisjointSet();

  // Passe 1 : Lier les IFU et Noms partageant des enregistrements
  (tfuData || []).forEach((liq: any) => {
    const contrib = Array.isArray(liq.contribuable) ? liq.contribuable[0] : liq.contribuable;
    if (!contrib && !liq.reference_liq) return;

    const ifu = (contrib?.ifu_npi || "").trim();
    const name = (contrib?.nom_prenoms || "").trim();
    const normIfu = normalizeKey(ifu);
    const normName = normalizeKey(name);

    const ifuNode = normIfu ? `IFU_${normIfu}` : "";
    const nameNode = normName ? `NAME_${normName}` : "";

    if (ifuNode && nameNode) {
      dsu.union(ifuNode, nameNode);
    } else if (ifuNode) {
      dsu.find(ifuNode);
    } else if (nameNode) {
      dsu.find(nameNode);
    }
  });

  (tpsData || []).forEach((tps: any) => {
    const contrib = Array.isArray(tps.contribuable) ? tps.contribuable[0] : tps.contribuable;
    const ifu = (contrib?.ifu_nc || tps.ifu_nc || "").trim();
    const name = (contrib?.nom_raison_sociale || tps.nom_raison_sociale || "").trim();
    const normIfu = normalizeKey(ifu);
    const normName = normalizeKey(name);

    const ifuNode = normIfu ? `IFU_${normIfu}` : "";
    const nameNode = normName ? `NAME_${normName}` : "";

    if (ifuNode && nameNode) {
      dsu.union(ifuNode, nameNode);
    } else if (ifuNode) {
      dsu.find(ifuNode);
    } else if (nameNode) {
      dsu.find(nameNode);
    }
  });

  // Map d'agrégation
  const taxpayersMap = new Map<string, {
    ifu: string;
    name: string;
    phone: string;
    communesSet: Set<string>;
    propertiesMap: Map<string, boolean>;
    activitiesMap: Map<string, boolean>;
    liquidationsCount: number;
    totalAmountDues: number;
    totalPaid: number;
    lastDate: string;
    keysToMatch: string[];
  }>();

  // Passe 2 : Aggrégation TFU
  (tfuData || []).forEach((liq: any) => {
    const contrib = Array.isArray(liq.contribuable) ? liq.contribuable[0] : liq.contribuable;
    if (!contrib && !liq.reference_liq) return;

    const ifu = (contrib?.ifu_npi || "").trim();
    const name = (contrib?.nom_prenoms || "Contribuable Inconnu").trim();
    const phone = (contrib?.telephone || "").trim();
    const commune = (liq.commune || "").trim();

    const normIfu = normalizeKey(ifu);
    const normName = normalizeKey(name);
    const node = normIfu ? `IFU_${normIfu}` : normName ? `NAME_${normName}` : "";
    if (!node) return;

    const key = dsu.find(node);

    // Calcul dynamique des droits TFU
    let totalDroits = 0;
    try {
      const calc = buildLiquidationCalculations({
        fullname: name,
        ifuNpi: ifu,
        phone,
        commune,
        arrondissement: liq.arrondissement || "",
        quartier: liq.quartier || "",
        typeBien: liq.type_bien || "NON_BATI",
        superficie: Number(liq.superficie) || 0,
        superficieImposable: liq.superficie_imposable !== null ? Number(liq.superficie_imposable) : "",
        valeurLocative: Number(liq.valeur_locative) || 0,
        startYear: Number(liq.start_year) || 2023,
        isLoue: Boolean(liq.is_loue),
        valeurIrf: Number(liq.valeur_irf) || "",
        description: liq.description || "",
      });
      totalDroits = calc.totalDu || 0;
    } catch (e) {
      console.error("Error calculating TFU droits:", e);
    }

    const isPaid = liq.status === "PAYE";
    const paidAmount = isPaid ? totalDroits : 0;

    let existing = taxpayersMap.get(key);
    if (!existing) {
      existing = {
        ifu: ifu || "N/A",
        name,
        phone,
        communesSet: new Set(commune ? [commune] : []),
        propertiesMap: new Map<string, boolean>(),
        activitiesMap: new Map<string, boolean>(),
        liquidationsCount: 0,
        totalAmountDues: 0,
        totalPaid: 0,
        lastDate: liq.created_at || new Date().toISOString(),
        keysToMatch: [ifu, name, phone, commune, liq.reference_liq].filter(Boolean),
      };
      taxpayersMap.set(key, existing);
    } else {
      if (!existing.phone && phone) existing.phone = phone;
      if ((!existing.ifu || existing.ifu === "N/A") && ifu) existing.ifu = ifu;
      if ((existing.name === "Contribuable Inconnu" || !existing.name) && name) existing.name = name;
      if (commune) existing.communesSet.add(commune);
      if (new Date(liq.created_at) > new Date(existing.lastDate)) {
        existing.lastDate = liq.created_at;
      }
      if (liq.reference_liq) existing.keysToMatch.push(liq.reference_liq);
      if (ifu) existing.keysToMatch.push(ifu);
      if (name) existing.keysToMatch.push(name);
    }

    const propKey = liq.id || `${liq.commune}_${liq.arrondissement}_${liq.type_bien}_${liq.superficie}_${liq.valeur_locative}`;
    existing.propertiesMap.set(propKey, true);
    existing.liquidationsCount += 1;
    existing.totalAmountDues += totalDroits;
    existing.totalPaid += paidAmount;
  });

  // Passe 2 : Agrégation TPS
  (tpsData || []).forEach((tps: any) => {
    const contrib = Array.isArray(tps.contribuable) ? tps.contribuable[0] : tps.contribuable;
    const ifu = (contrib?.ifu_nc || tps.ifu_nc || "").trim();
    const name = (contrib?.nom_raison_sociale || tps.nom_raison_sociale || "Contribuable Inconnu").trim();
    const phone = (contrib?.telephone || tps.telephone || "").trim();
    const commune = (tps.commune || "").trim();

    const normIfu = normalizeKey(ifu);
    const normName = normalizeKey(name);
    const node = normIfu ? `IFU_${normIfu}` : normName ? `NAME_${normName}` : "";
    if (!node) return;

    const key = dsu.find(node);

    // Calcul dynamique des droits TPS
    let totalDroits = 0;
    try {
      const calc = buildTpsCalculations({
        montantAutresActivites: Number(tps.montant_autres_activites) || 0,
        acomptesPayes: Number(tps.acomptes_payes) || 0,
        startYear: Number(tps.start_year) || 2024,
      });
      totalDroits = calc.impotDu || 0;
    } catch (e) {
      console.error("Error calculating TPS droits:", e);
    }

    const isPaid = tps.status === "PAYE" || tps.status === "VALIDE";
    const paidAmount = isPaid ? totalDroits : 0;

    let existing = taxpayersMap.get(key);
    if (!existing) {
      existing = {
        ifu: ifu || "N/A",
        name,
        phone,
        communesSet: new Set(commune ? [commune] : []),
        propertiesMap: new Map<string, boolean>(),
        activitiesMap: new Map<string, boolean>(),
        liquidationsCount: 0,
        totalAmountDues: 0,
        totalPaid: 0,
        lastDate: tps.created_at || new Date().toISOString(),
        keysToMatch: [ifu, name, phone, commune, tps.reference_tps].filter(Boolean),
      };
      taxpayersMap.set(key, existing);
    } else {
      if (!existing.phone && phone) existing.phone = phone;
      if ((!existing.ifu || existing.ifu === "N/A") && ifu) existing.ifu = ifu;
      if ((existing.name === "Contribuable Inconnu" || !existing.name) && name) existing.name = name;
      if (commune) existing.communesSet.add(commune);
      if (new Date(tps.created_at) > new Date(existing.lastDate)) {
        existing.lastDate = tps.created_at;
      }
      if (tps.reference_tps) existing.keysToMatch.push(tps.reference_tps);
      if (ifu) existing.keysToMatch.push(ifu);
      if (name) existing.keysToMatch.push(name);
    }

    const actKey = tps.id || `${tps.commune}_${tps.activite}`;
    existing.activitiesMap.set(actKey, true);
    existing.liquidationsCount += 1;
    existing.totalAmountDues += totalDroits;
    existing.totalPaid += paidAmount;
  });

  let allList = Array.from(taxpayersMap.entries()).map(([id, t]) => {
    const balanceDue = Math.max(0, t.totalAmountDues - t.totalPaid);
    const communesList = Array.from(t.communesSet);
    return {
      id,
      ifu: t.ifu,
      name: t.name,
      phone: t.phone || "—",
      communes: communesList,
      commune: communesList.length > 0 ? communesList.join(", ") : "—",
      totalProperties: t.propertiesMap.size,
      totalActivities: t.activitiesMap.size,
      totalLiquidations: t.liquidationsCount,
      totalAmountDues: t.totalAmountDues,
      totalPaid: t.totalPaid,
      balanceDue,
      status: (balanceDue === 0 ? "A_JOUR" : "SOLDE_DEBITEUR") as "A_JOUR" | "SOLDE_DEBITEUR",
      lastOperationDate: t.lastDate,
      _searchStr: t.keysToMatch.join(" ").toLowerCase(),
    };
  });

  // Filtrage
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    allList = allList.filter((item) =>
      item._searchStr.includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.ifu.toLowerCase().includes(q) ||
      item.phone.includes(q) ||
      item.commune.toLowerCase().includes(q)
    );
  }

  // Tri par date récents d'abord
  allList.sort((a, b) => new Date(b.lastOperationDate).getTime() - new Date(a.lastOperationDate).getTime());

  const total = allList.length;
  const totalUpToDate = allList.filter((t) => t.status === "A_JOUR").length;
  const totalDebtors = allList.filter((t) => t.status === "SOLDE_DEBITEUR").length;
  const totalArrears = allList.reduce((sum, t) => sum + t.balanceDue, 0);

  const startIndex = (page - 1) * pageSize;
  const paginatedData = allList.slice(startIndex, startIndex + pageSize).map(({ _searchStr, ...rest }) => rest);

  return {
    data: paginatedData,
    total,
    totalUpToDate,
    totalDebtors,
    totalArrears,
    page,
    pageSize,
  };
}

/**
 * Récupère le détail exhaustif d'un contribuable spécifique
 */
export async function getTaxpayerDetails(keyOrIfuOrName: string): Promise<TaxpayerDetail | null> {
  const supabase = await createClient();

  const searchClean = keyOrIfuOrName.replace(/^(IFU_|NAME_)/, "").trim();

  // 1. Récupérer toutes les liquidations TFU
  const { data: tfuList, error: tfuErr } = await supabase
    .from("liquidations")
    .select(`
      id,
      status,
      commune,
      arrondissement,
      quartier,
      type_bien,
      superficie,
      superficie_imposable,
      valeur_locative,
      is_loue,
      valeur_irf,
      description,
      start_year,
      reference_liq,
      created_at,
      contribuable:contribuables (
        id,
        nom_prenoms,
        ifu_npi,
        telephone
      )
    `)
    .order("created_at", { ascending: false });

  if (tfuErr) console.error("Error in getTaxpayerDetails TFU:", tfuErr);

  // 2. Récupérer toutes les liquidations TPS
  const { data: tpsList, error: tpsErr } = await supabase
    .from("tps_liquidations")
    .select(`
      id,
      status,
      commune,
      arrondissement,
      quartier,
      activite,
      montant_autres_activites,
      acomptes_payes,
      start_year,
      reference_tps,
      created_at,
      contribuable:tps_contribuables (
        id,
        nom_raison_sociale,
        ifu_nc,
        telephone
      )
    `)
    .order("created_at", { ascending: false });

  if (tpsErr) console.error("Error in getTaxpayerDetails TPS:", tpsErr);

  // Construction du graphe d'équivalence (DisjointSet)
  const dsu = new DisjointSet();

  (tfuList || []).forEach((liq: any) => {
    const contrib = Array.isArray(liq.contribuable) ? liq.contribuable[0] : liq.contribuable;
    if (!contrib && !liq.reference_liq) return;
    const ifu = (contrib?.ifu_npi || "").trim();
    const name = (contrib?.nom_prenoms || "").trim();
    const normIfu = normalizeKey(ifu);
    const normName = normalizeKey(name);
    const ifuNode = normIfu ? `IFU_${normIfu}` : "";
    const nameNode = normName ? `NAME_${normName}` : "";

    if (ifuNode && nameNode) dsu.union(ifuNode, nameNode);
    else if (ifuNode) dsu.find(ifuNode);
    else if (nameNode) dsu.find(nameNode);
  });

  (tpsList || []).forEach((tps: any) => {
    const contrib = Array.isArray(tps.contribuable) ? tps.contribuable[0] : tps.contribuable;
    const ifu = (contrib?.ifu_nc || tps.ifu_nc || "").trim();
    const name = (contrib?.nom_raison_sociale || tps.nom_raison_sociale || "").trim();
    const normIfu = normalizeKey(ifu);
    const normName = normalizeKey(name);
    const ifuNode = normIfu ? `IFU_${normIfu}` : "";
    const nameNode = normName ? `NAME_${normName}` : "";

    if (ifuNode && nameNode) dsu.union(ifuNode, nameNode);
    else if (ifuNode) dsu.find(ifuNode);
    else if (nameNode) dsu.find(nameNode);
  });

  const normTarget = normalizeKey(searchClean);

  // Trouver le cluster cible
  let targetRoot = "";
  if (keyOrIfuOrName.startsWith("IFU_") || keyOrIfuOrName.startsWith("NAME_")) {
    if (dsu.parent.has(keyOrIfuOrName)) {
      targetRoot = dsu.find(keyOrIfuOrName);
    }
  }

  if (!targetRoot && normTarget) {
    if (dsu.parent.has(`IFU_${normTarget}`)) {
      targetRoot = dsu.find(`IFU_${normTarget}`);
    } else if (dsu.parent.has(`NAME_${normTarget}`)) {
      targetRoot = dsu.find(`NAME_${normTarget}`);
    }
  }

  if (!targetRoot && normTarget) {
    // Recherche de secours
    for (const liq of (tfuList || [])) {
      const contrib = Array.isArray(liq.contribuable) ? liq.contribuable[0] : liq.contribuable;
      const ifu = (contrib?.ifu_npi || "").trim();
      const name = (contrib?.nom_prenoms || "").trim();
      const normIfu = normalizeKey(ifu);
      const normName = normalizeKey(name);

      if (normIfu === normTarget || normName === normTarget || normIfu.includes(normTarget) || normName.includes(normTarget)) {
        const node = normIfu ? `IFU_${normIfu}` : normName ? `NAME_${normName}` : "";
        if (node) {
          targetRoot = dsu.find(node);
          break;
        }
      }
    }
  }

  let matchIfu = "";
  let matchName = "";
  let matchPhone = "";

  const matchedPropertiesMap = new Map<string, any>();
  const matchedActivitiesMap = new Map<string, any>();
  const matchedLiquidations: TaxpayerDetail["liquidations"] = [];

  let totalLiquidated = 0;
  let totalPaid = 0;

  const communesSet = new Set<string>();

  // Filtrer TFU
  (tfuList || []).forEach((liq: any) => {
    const contrib = Array.isArray(liq.contribuable) ? liq.contribuable[0] : liq.contribuable;
    if (!contrib && !liq.reference_liq) return;

    const ifu = (contrib?.ifu_npi || "").trim();
    const name = (contrib?.nom_prenoms || "").trim();
    const normIfu = normalizeKey(ifu);
    const normName = normalizeKey(name);

    const node = normIfu ? `IFU_${normIfu}` : normName ? `NAME_${normName}` : "";
    const itemRoot = node ? dsu.find(node) : "";

    const isMatch = (targetRoot && itemRoot === targetRoot) ||
      (normTarget && (normIfu === normTarget || normName === normTarget));

    if (!isMatch) return;

    if (!matchIfu && ifu) matchIfu = ifu;
    if (!matchName && name) matchName = name;
    if (!matchPhone && contrib?.telephone) matchPhone = contrib.telephone;
    if (liq.commune) communesSet.add(liq.commune.trim());

    const propKey = liq.id || `${liq.commune}_${liq.arrondissement}_${liq.type_bien}_${liq.superficie}_${liq.valeur_locative}`;
    if (!matchedPropertiesMap.has(propKey)) {
      matchedPropertiesMap.set(propKey, {
        id: liq.id,
        typeBien: liq.type_bien || "NON_BATI",
        commune: liq.commune || "—",
        arrondissement: liq.arrondissement || "—",
        quartier: liq.quartier || "—",
        superficie: Number(liq.superficie) || 0,
        superficieImposable: Number(liq.superficie_imposable) || 0,
        valeurLocative: Number(liq.valeur_locative) || 0,
        isLoue: Boolean(liq.is_loue),
        description: liq.description || "",
        referenceLiq: liq.reference_liq || "—",
        created_at: liq.created_at,
      });
    }

    let amount = 0;
    try {
      const calc = buildLiquidationCalculations({
        fullname: name,
        ifuNpi: ifu,
        phone: contrib?.telephone || "",
        commune: liq.commune || "",
        arrondissement: liq.arrondissement || "",
        quartier: liq.quartier || "",
        typeBien: liq.type_bien || "NON_BATI",
        superficie: Number(liq.superficie) || 0,
        superficieImposable: liq.superficie_imposable !== null ? Number(liq.superficie_imposable) : "",
        valeurLocative: Number(liq.valeur_locative) || 0,
        startYear: Number(liq.start_year) || 2023,
        isLoue: Boolean(liq.is_loue),
        valeurIrf: Number(liq.valeur_irf) || "",
        description: liq.description || "",
      });
      amount = calc.totalDu || 0;
    } catch (e) {
      console.error("Error calc details TFU:", e);
    }

    const isPaid = liq.status === "PAYE";

    totalLiquidated += amount;
    if (isPaid) totalPaid += amount;

    matchedLiquidations.push({
      id: liq.id,
      type: "TFU",
      reference: liq.reference_liq || "—",
      commune: liq.commune || "—",
      startYear: Number(liq.start_year) || 2024,
      totalDroits: amount,
      status: liq.status || "EN_ATTENTE",
      created_at: liq.created_at,
      description: `TFU ${liq.type_bien === "BATI" ? "Foncier Bâti" : "Foncier Non Bâti"} - ${liq.commune || ""}`,
    });
  });

  // Filtrer TPS
  (tpsList || []).forEach((tps: any) => {
    const contrib = Array.isArray(tps.contribuable) ? tps.contribuable[0] : tps.contribuable;
    const ifu = (contrib?.ifu_nc || tps.ifu_nc || "").trim();
    const name = (contrib?.nom_raison_sociale || tps.nom_raison_sociale || "").trim();
    const normIfu = normalizeKey(ifu);
    const normName = normalizeKey(name);

    const node = normIfu ? `IFU_${normIfu}` : normName ? `NAME_${normName}` : "";
    const itemRoot = node ? dsu.find(node) : "";

    const isMatch = (targetRoot && itemRoot === targetRoot) ||
      (normTarget && (normIfu === normTarget || normName === normTarget));

    if (!isMatch) return;

    if (!matchIfu && ifu) matchIfu = ifu;
    if (!matchName && name) matchName = name;
    if (!matchPhone && tps.telephone) matchPhone = tps.telephone;
    if (tps.commune) communesSet.add(tps.commune.trim());

    const actKey = tps.id || `${tps.commune}_${tps.activite}`;
    if (!matchedActivitiesMap.has(actKey)) {
      matchedActivitiesMap.set(actKey, {
        id: tps.id,
        activite: tps.activite || "Activite non specifiee",
        commune: tps.commune || "—",
        arrondissement: tps.arrondissement || "—",
        quartier: tps.quartier || "—",
        montantAutresActivites: Number(tps.montant_autres_activites) || 0,
        referenceTps: tps.reference_tps || "—",
        created_at: tps.created_at,
      });
    }

    let amount = 0;
    try {
      const calc = buildTpsCalculations({
        montantAutresActivites: Number(tps.montant_autres_activites) || 0,
        acomptesPayes: Number(tps.acomptes_payes) || 0,
        startYear: Number(tps.start_year) || 2024,
      });
      amount = calc.impotDu || 0;
    } catch (e) {
      console.error("Error calc details TPS:", e);
    }

    const isPaid = tps.status === "PAYE" || tps.status === "VALIDE";

    totalLiquidated += amount;
    if (isPaid) totalPaid += amount;

    matchedLiquidations.push({
      id: tps.id,
      type: "TPS",
      reference: tps.reference_tps || "—",
      commune: tps.commune || "—",
      startYear: Number(tps.start_year) || 2024,
      totalDroits: amount,
      status: tps.status || "EN_ATTENTE",
      created_at: tps.created_at,
      description: `TPS - ${tps.activite || "Activité synthétique"}`,
    });
  });

  if (matchedLiquidations.length === 0 && !matchName) {
    return null;
  }

  matchedLiquidations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const balanceDue = Math.max(0, totalLiquidated - totalPaid);
  const communesList = Array.from(communesSet);

  return {
    ifu: matchIfu || "Non renseigné",
    name: matchName || searchClean || "Contribuable",
    phone: matchPhone || "—",
    communes: communesList,
    commune: communesList.length > 0 ? communesList.join(", ") : "—",
    arrondissement: "—",
    quartier: "—",
    properties: Array.from(matchedPropertiesMap.values()),
    activities: Array.from(matchedActivitiesMap.values()),
    liquidations: matchedLiquidations,
    totalLiquidated,
    totalPaid,
    balanceDue,
  };
}

/**
 * Recherche rapide d'un contribuable par IFU/NPI pour pré-remplissage des formulaires TFU & TPS
 */
export async function lookupTaxpayerByIdentifier(identifier: string): Promise<{
  fullname: string;
  phone: string;
  ifuNpi: string;
  source: "TFU" | "TPS";
} | null> {
  if (!identifier) return null;
  const cleanId = identifier.trim().replace(/\D/g, "");
  if (cleanId.length < 5) return null;

  const supabase = await createClient();

  // 1. Chercher dans contribuables (TFU)
  try {
    const { data: contribData } = await supabase
      .from("contribuables")
      .select("nom_prenoms, ifu_npi, telephone")
      .or(`ifu_npi.eq.${cleanId},ifu_npi.ilike.%${cleanId}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (contribData && contribData.length > 0 && contribData[0].nom_prenoms) {
      return {
        fullname: contribData[0].nom_prenoms,
        phone: contribData[0].telephone || "",
        ifuNpi: contribData[0].ifu_npi || cleanId,
        source: "TFU",
      };
    }
  } catch (err) {
    console.error("Erreur lookup contribuables (TFU):", err);
  }

  // 2. Chercher dans tps_contribuables (TPS)
  try {
    const { data: tpsContribData } = await supabase
      .from("tps_contribuables")
      .select("nom_raison_sociale, ifu_nc, telephone")
      .or(`ifu_nc.eq.${cleanId},ifu_nc.ilike.%${cleanId}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (tpsContribData && tpsContribData.length > 0 && tpsContribData[0].nom_raison_sociale) {
      return {
        fullname: tpsContribData[0].nom_raison_sociale,
        phone: tpsContribData[0].telephone || "",
        ifuNpi: tpsContribData[0].ifu_nc || cleanId,
        source: "TPS",
      };
    }
  } catch (err) {
    console.error("Erreur lookup tps_contribuables (TPS):", err);
  }

  return null;
}


