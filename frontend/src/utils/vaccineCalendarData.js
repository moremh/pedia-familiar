export const NATIONAL_VACCINE_CALENDAR = [
  {
    id: 'newborn',
    ageLabel: 'Recién nacido',
    items: [
      {
        key: 'newborn-bcg',
        name: 'BCG',
        note: 'Antes de egresar de la maternidad.',
      },
      {
        key: 'newborn-hepatitis-b',
        name: 'Hepatitis B',
        note: 'Aplicar en las primeras 12 horas de vida.',
      },
    ],
  },
  {
    id: '2-months',
    ageLabel: '2 meses',
    items: [
      {
        key: '2m-pneumococcal',
        name: 'Neumococo conjugada',
        note: 'Dosis correspondiente a los 2 meses.',
      },
      {
        key: '2m-quintuple',
        name: 'Quíntuple',
        note: 'Dosis correspondiente a los 2 meses.',
      },
      {
        key: '2m-ipv',
        name: 'IPV inactivada',
        note: 'Dosis correspondiente a los 2 meses.',
      },
      {
        key: '2m-rotavirus',
        name: 'Rotavirus',
        note: 'Dosis correspondiente a los 2 meses.',
      },
    ],
  },
  {
    id: '3-months',
    ageLabel: '3 meses',
    items: [
      {
        key: '3m-meningococcal-acwy',
        name: 'Meningococo ACWY',
        note: 'Dosis correspondiente a los 3 meses.',
      },
    ],
  },
  {
    id: '4-months',
    ageLabel: '4 meses',
    items: [
      {
        key: '4m-pneumococcal',
        name: 'Neumococo conjugada',
        note: 'Dosis correspondiente a los 4 meses.',
      },
      {
        key: '4m-quintuple',
        name: 'Quíntuple',
        note: 'Dosis correspondiente a los 4 meses.',
      },
      {
        key: '4m-ipv',
        name: 'IPV inactivada',
        note: 'Dosis correspondiente a los 4 meses.',
      },
      {
        key: '4m-rotavirus',
        name: 'Rotavirus',
        note: 'Dosis correspondiente a los 4 meses.',
      },
    ],
  },
  {
    id: '5-months',
    ageLabel: '5 meses',
    items: [
      {
        key: '5m-meningococcal-acwy',
        name: 'Meningococo ACWY',
        note: 'Dosis correspondiente a los 5 meses.',
      },
    ],
  },
  {
    id: '6-months',
    ageLabel: '6 meses',
    items: [
      {
        key: '6m-quintuple',
        name: 'Quíntuple',
        note: 'Dosis correspondiente a los 6 meses.',
      },
      {
        key: '6m-ipv',
        name: 'IPV inactivada',
        note: 'Dosis correspondiente a los 6 meses.',
      },
    ],
  },
  {
    id: '6-to-24-months',
    ageLabel: '6 a 24 meses',
    items: [
      {
        key: '6-24m-flu',
        name: 'Gripe',
        note: 'A partir de los 6 meses y hasta los 24 meses, según el esquema correspondiente.',
      },
    ],
  },
  {
    id: '12-months',
    ageLabel: '12 meses',
    items: [
      {
        key: '12m-pneumococcal',
        name: 'Neumococo conjugada',
        note: 'Dosis correspondiente a los 12 meses.',
      },
      {
        key: '12m-triple-viral',
        name: 'Triple Viral SRP',
        note: 'Dosis correspondiente a los 12 meses.',
      },
      {
        key: '12m-hepatitis-a',
        name: 'Hepatitis A',
        note: 'Dosis correspondiente a los 12 meses.',
      },
    ],
  },
  {
    id: '15-months',
    ageLabel: '15 meses',
    items: [
      {
        key: '15m-varicella',
        name: 'Varicela',
        note: 'Dosis correspondiente a los 15 meses.',
      },
      {
        key: '15m-meningococcal-acwy',
        name: 'Meningococo ACWY',
        note: 'Dosis correspondiente a los 15 meses.',
      },
    ],
  },
  {
    id: '15-to-18-months',
    ageLabel: '15 a 18 meses',
    items: [
      {
        key: '15-18m-quintuple',
        name: 'Quíntuple',
        note: 'Refuerzo entre los 15 y 18 meses.',
      },
    ],
  },
  {
    id: '18-months',
    ageLabel: '18 meses',
    items: [
      {
        key: '18m-yellow-fever',
        name: 'Fiebre amarilla',
        note: 'Para residentes en zona de riesgo.',
        conditional: true,
      },
    ],
  },
  {
    id: '5-years',
    ageLabel: '5 años',
    items: [
      {
        key: '5y-ipv',
        name: 'IPV inactivada',
        note: 'Dosis correspondiente a los 5 años.',
      },
      {
        key: '5y-triple-bacterial-cellular',
        name: 'Triple bacteriana celular',
        note: 'Dosis correspondiente a los 5 años.',
      },
      {
        key: '5y-varicella',
        name: 'Varicela',
        note: 'Dosis correspondiente a los 5 años.',
      },
      {
        key: '5y-triple-viral',
        name: 'Triple Viral',
        note: 'Dosis correspondiente a los 5 años.',
      },
      {
        key: '5y-flu-risk',
        name: 'Gripe',
        note: 'Para personas con factores de riesgo.',
        conditional: true,
      },
    ],
  },
  {
    id: '11-years',
    ageLabel: '11 años',
    items: [
      {
        key: '11y-hepatitis-b',
        name: 'Hepatitis B',
        note: 'Iniciar o completar esquema de 3 dosis.',
      },
      {
        key: '11y-meningococcal-acwy',
        name: 'Meningococo ACWY',
        note: 'Dosis correspondiente a los 11 años.',
      },
      {
        key: '11y-triple-viral',
        name: 'Triple Viral',
        note: 'Iniciar o completar esquema.',
      },
      {
        key: '11y-triple-bacterial-acellular',
        name: 'Triple bacteriana acelular',
        note: 'Refuerzo.',
      },
      {
        key: '11y-hpv',
        name: 'VPH',
        note: 'Única dosis.',
      },
      {
        key: '11y-yellow-fever',
        name: 'Fiebre amarilla',
        note: 'Para residentes en zona de riesgo si la primera dosis se recibió antes de los 2 años.',
        conditional: true,
      },
      {
        key: '11y-flu-risk',
        name: 'Gripe',
        note: 'Para personas con factores de riesgo.',
        conditional: true,
      },
    ],
  },
  {
    id: '15-to-20-years',
    ageLabel: '15 a 20 años',
    items: [
      {
        key: '15-20y-hepatitis-b',
        name: 'Hepatitis B',
        note: 'Iniciar o completar esquema de 3 dosis.',
      },
      {
        key: '15-20y-triple-viral',
        name: 'Triple Viral',
        note: 'Iniciar o completar esquema.',
      },
      {
        key: '15-20y-argentine-hemorrhagic-fever',
        name: 'Fiebre Hemorrágica Argentina',
        note: 'Para residentes y/o trabajadores con riesgo ocupacional o en zona de riesgo que no la hayan recibido antes.',
        conditional: true,
      },
      {
        key: '15-20y-flu-risk',
        name: 'Gripe',
        note: 'Para personas con factores de riesgo.',
        conditional: true,
      },
      {
        key: '15-20y-double-bacterial',
        name: 'Doble bacteriana',
        note: 'Refuerzo cada 10 años, según esquema.',
      },
    ],
  },
];

export const NATIONAL_VACCINE_CALENDAR_TOTAL =
  NATIONAL_VACCINE_CALENDAR.reduce(
    (total, group) => total + group.items.length,
    0,
  );
