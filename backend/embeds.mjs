export const CPX_GOLD = 0xe4c526;
export const CPX_RED = 0xc65b50;
export const CPX_GREEN = 0x58a978;
const cut = (value, max) => {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, '') + '…';
};

// Keep each message within Discord's field and 6,000-character limits.
export function embedMessage(title, description, options = {}) {
  const embed = {
    title: cut(title, 256),
    color: options.color ?? CPX_GOLD,
    footer: {text: cut(options.footer ?? 'CPX ROLEPLAY • cpx guardian', 256)},
  };
  if (description) embed.description = cut(description, 4096);
  let remaining = 5700 - embed.title.length - (embed.description?.length ?? 0) - embed.footer.text.length;
  for (const field of (options.fields ?? []).slice(0, 25)) {
    const name = cut(field.name, 256) || 'Informação';
    if (remaining <= name.length + 1) break;
    const value = cut(String(field.value ?? '').trim() || 'Não informado.', Math.min(1024, remaining - name.length));
    (embed.fields ??= []).push({name, value, inline: field.inline === true});
    remaining -= name.length + value.length;
  }
  if (options.timestamp) embed.timestamp = options.timestamp;
  return {content: '', embeds: [embed], components: options.components ?? [], allowed_mentions: {parse: []}};
}

export function formatReply(value, title = 'cpx guardian', error = false) {
  if (typeof value === 'string') return embedMessage(title, value, error ? {color: CPX_RED} : {});
  if (!value.embeds?.length) return {...value, ...embedMessage(title, value.content, {components: value.components, color: error ? CPX_RED : CPX_GOLD}), ...(value.flags === undefined ? {} : {flags: value.flags})};
  return {...value, content: '', allowed_mentions: {parse: []}};
}

export function announcementMessage(text) {
  const description = String(text).replaceAll('@everyone', '').replaceAll('@here', '@\u200bhere').trim();
  const message = embedMessage('Comunicado oficial', description || 'Comunicado da administração do CPX ROLEPLAY.');
  return {...message, content: '@everyone', allowed_mentions: {parse: ['everyone']}};
}

export function commandTitle(i) {
  const group = i.data?.options?.[0];
  if (group?.type === 2 && group.name === 'ticket') return 'Atendimento privado';
  const name=i.data?.name==='cpx'?group?.name:i.data?.name;
  return ({ticketpainel:'Central de Suporte',ajuda:'Central de ajuda',portal:'Portal da cidade',status:'Status do serviço',saldo:'Saldo da conta RP',rg:'Registro do personagem',extrato:'Extrato da conta RP',perguntar:'Atendimento',avisos:'Notificações financeiras',transferir:'Transferência RP',ajustar:'Ajuste de saldo RP',pagar:'Pagamento institucional',advertir:'Advertência',castigo:'Restrição temporária',comunicado:'Comunicado do Instaplexo'})[name] ?? 'cpx guardian';
}
