/* =====================================================================
   Preguntas rompe-hielo · Dinamiclase
   - Preguntas al azar sin repetir hasta agotar el banco
   - Historial (anterior), temporizador y "¿Quién responde?"
   - Preguntas propias guardadas en el navegador
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, parseList, sfx, copyText } = DC.utils;
  const $ = (s) => document.querySelector(s);

  /* ========= Banco de preguntas ========= */
  const BANCO = [
    "¿Si no hubieses nacido en tu país de dónde serías?",
    "¿Qué superpoder te gustaría tener y cuál sería tu debilidad?",
    "¿Qué mensaje pondrías en tu tumba?",
    "¿Cuál es tu palabra favorita y por qué?",
    "Estamos a punto de morir y tienes que salvar a tres personas de esta clase. ¿A quiénes eliges?",
    "¿Cuál es la situación más peligrosa en la que has estado?",
    "¿Cuál es la primera regla del club de la pelea?",
    "¿Cuál es el mejor episodio de Bob esponja?",
    "¿Cuál es el mejor consejo que les puedes dar a la clase?",
    "¿Cuál es el mejor juguete que tuviste?",
    "Si mañana se descubriera que los animales siempre nos han entendido perfectamente pero fingían para no tener responsabilidades, ¿con qué especie te disculparías primero?",
    "¿Qué habilidad tienes que te haría sobrevivir en un apocalipsis zombi?",
    "¿Cuál es tu antojo de comida callejera más recurrente?",
    "¿Qué canción te sabes desde el principio hasta el final?",
    "Tienes la opción de saber la fecha exacta del fin del mundo o la fecha exacta de tu propia muerte, pero estás obligado a elegir una. ¿Cuál quieres saber?",
    "Durante la cuarentena ¿cómo te distraías?",
    "Si fueras un viajero del tiempo en una cueva hace miles de años ¿qué escribirías?",
    "¿Cuál es la forma más ingeniosa para copiar en un examen?",
    "¿Qué cosa debería ser gratis pero no lo es?",
    "¿Qué cosa inofensiva te aterrorizaba de niño?",
    "¿Cuál es el tema del que podrías hablar durante una hora entera?",
    "¿Cuál es el nombre más raro que has escuchado en tu vida?",
    "¿Si tuvieras que darle un consejo a tu yo de hace 5 años qué le dirías?",
    "¿Cuál es el remedio casero más efectivo que conoces?",
    "¿Qué platillo puedes cocinar a la perfección?",
    "¿Qué película te hace llorar siempre?",
    "¿Cuál es una opinión que defendías a muerte hace cinco años y que hoy te parece absurda?",
    "¿Qué sonido cotidiano te genera una sensación de paz inmediata?",
    "Te permiten eliminar un solo invento de la historia humana sin que afecte el resto del avance tecnológico. ¿Cuál borras para siempre?",
    "Si pudieras ver una estadística flotando sobre la cabeza de cada persona con la que te cruzas en la calle, ¿qué dato te gustaría que fuera?",
    "Si pudieras colocar una valla publicitaria en la autopista más transitada del mundo con una frase corta de tu autoría, ¿qué escribirías?",
    "Te dan la oportunidad de enviar una nota de tres palabras a tu versión de hace diez años, sabiendo que la leerá justo antes de dormir. ¿Qué dicen esas tres palabras?",
    "Si el dinero dejara de existir mañana y el valor de las personas se midiera por una habilidad no profesional, ¿de qué vivirías tú?",
    "Si pudieras programar un único recordatorio recurrente que sonara en la mente de todos los seres humanos una vez al año, ¿qué mensaje enviaría?",
    "Si tuvieras que esconder una memoria USB con secretos de estado en una casa común y corriente para que un equipo de búsqueda no la encuentre en 24 horas, ¿dónde la pondrías?",
    "Si los humanos tuvieran que entrar en hibernación durante tres meses al año como ciertos animales, ¿qué harías el día antes de dormir?",
    "¿Qué miedo de niño todavía te dura un poquito?",
    "¿Qué dato inútil te sabes de memoria y por qué crees que se te quedó?",
       "¿Qué habilidad tienes que nunca aparecería en un currículum?",
    "Si cada persona naciera con un manual de instrucciones, ¿qué diría la primera página del tuyo?",
    "Si cada mentira que dijeras te hiciera crecer un centímetro, ¿cuánto medirías hoy?",
      "Si pudieras quitarle a los humanos una necesidad (dormir, comer o ir al baño), ¿cuál quitarías y en qué usarías ese tiempo?",
      "Si los recuerdos se pudieran vender, ¿cuál no venderías por ningún precio?",
      "¿Qué cosa que todos damos por hecho te parece un pequeño milagro?",
      "¿Qué le falta a tu colonia o barrio para ser perfecto?",
      "Si de este año solo pudieras guardar un recuerdo, ¿cuál sería?",
       "¿Qué idea defenderías aunque te quedaras solo en contra de todos?",
           "¿A qué personajes de la historia pondrías a debatir?",
    "Si pudieras renombrar el lugar donde vives ¿cómo lo llamarías?",
    "Si pudieras domesticar un animal salvaje, ¿cuál sería?",
    "Si el día tuviera 25 horas ¿qué harías en esa hora extra?",
    "¿Qué estarías haciendo ahora si no estuvieras en clase?",
    "¿Te gustaría tener un clon?",
    "¿Cuál es la combinación de comida más rara que te gusta?",
    "Están a punto de llevarte a la silla eléctrica ¿Qué pedirías como última comida?",
    "¿Cuál es la persona más famosa que has conocido?",
    "¿Cuál fue el remedio casero más raro que te dieron de niño?",
    "¿Cuál es la leyenda más conocida del lugar en el que vives?",
    "¿Qué canción escuchaban tus papás que terminó gustándote?",
    "Si tuvieras que revivir a una persona para hablar durante una hora con ella ¿Quién sería?",
    "Estás a punto de entrar al ring de boxeo ¿Cuál canción va a sonar mientras ingresas?",
    "¿Cómo te hiciste tu peor cicatriz?",
    "¿Te gustaría ser el peor jugador de un buen equipo o el mejor jugador de un mal equipo?",
    "Si pudieras inventar un día feriado con asueto ¿Cuál sería?",
    "Si te obligaran a comer una sola cosa por el resto de tu vida ¿Qué pedirías?",
    "Si pudieras tener un dinosaurio de mascota ¿Cuál sería?",
    "¿Qué comida sencilla te sabe a lujo?",
    "¿Qué cosas normales se vuelven más aterradoras por la noche?",
    "Si pudieras tener un cuarto de juegos ¿Qué tendría?",
    "¿Qué cosa le gusta a la mayoría de personas que a ti no te gusta?",
    "¿Cuál es la teoría conspirativa más loca que has escuchado?",
    "La tierra deja de rotar, así que en la mitad del planeta siempre será de día y en la otra mitad siempre de noche. ¿En qué lado te quedas?",
    "¿Para qué actividad te sientes muy viejo ya?",
    "Acabas de descubrir un nuevo planeta y debes ponerle un nombre. ¿Cuál sería?",
    "Tienes que inventar un nuevo sabor de sopa maruchan ¿Qué sabor sería?",
    "¿Qué olor te transporta automáticamente a tu infancia?",
    "¿Cuál es la frase que más recuerdas de alguna película?",
    "¿Cuál es el peor evento (concierto, congreso, reunión) en el que has estado?",
    "¿En tu casa tienes objetos que podrían ayudarte a matar un zombi?",
    "¿Cuál gasolinera tiene el mejor café?",
    "¿Qué canción volverías a poner de moda?",
    "¿Qué materia agregarías a la educación básica de nuestro país?",
    "¿Dónde y cómo le propondrías matrimonio a tu pareja?",
    "La humanidad va a desaparecer y debes dejar un mensaje a la siguiente forma de vida que resurja. ¿Qué le dirías?",
    "Si los dinosaurios no se hubieran extinto ¿Cómo crees que sería el mundo hoy?",
    "¿Qué objetos pondrías en una cápsula que se abrirá dentro de 1,000 años?",
    "¿Qué mentira te decían de niño que creías sin dudar?",
    "¿Cuál es un consejo de salud mental que todo el mundo debería conocer?",
    "Es el año 2126, los primeros astronautas llegan a marte y encuentran una cueva con un texto escrito. ¿Qué dice?",
    "¿A qué villano te unirías y por qué?",
    "¿Qué es lo más caro que arruinaste de niño?",
    "Tienes que escribir un libro con todos los recuerdos de tu vida ¿Cuántas páginas crees que tendría?",
    "Si ya no existen cabinas telefónicas… ¿Dónde se cambiaría Clark Kent para convertirse en Superman?",
    "¿Qué herramienta debería aprender a usar todo el mundo?",
    "¿Qué cosa es barata pero muy útil?",
    "Como joven, ¿qué consejo le darías a una persona adulta?",
    "Si pudieras crear una nueva comida chatarra ¿Qué crearías?",
    "Tienes el poder de convertir en oro lo que toques, pero solo lo puedes hacer una vez. ¿Qué tocarías?",
    "¿Qué acciones pequeñas te convierten en un mejor ser humano?",
    "Acabas de abrir un restaurante ¿Cómo se llama?",
    "¿Cuál es el estereotipo que todos tienen sobre el lugar dónde vives?",
    "Planeas robar un banco y debes armar tu equipo ¿A quiénes de esta clase eliges?",
    "Tienes la capacidad de viajar en el tiempo ¿Qué momento histórico te gustaría presenciar?",
    "¿Qué animal daría mucho miedo si pudiera volar?",
    "Van a lanzar una bomba cerca de aquí ¿Dónde te escondes?",
    "¿Qué cosa crees que todo el mundo debe experimentar una vez en la vida?",
    "Si pudieras cambiar el final de una película famosa ¿Cuál cambiarías y cómo?",
    "¿Qué superstición te parece más curiosa o divertida?",
    "Si tuvieras que elegir un apodo para ti mismo ¿Cuál sería?",
    "¿Qué invento moderno crees que sería inútil en 50 años?",
    "¿Qué objeto nunca falta en tu mochila o cartera?",
    "¿Cuál ha sido el mejor regalo que has dado en tu vida?",
    "Si fueras protagonista de un videojuego ¿Cómo se llamaría y de qué trataría?",
    "Si pudieras abrir un museo ¿De qué sería?",
    "Si pudieras pedirle un consejo a un personaje histórico ¿Quién sería?",
    "¿Qué animal crees que sería un buen presidente y por qué?",
    "¿Cuál es el objeto más raro que guardas y no quieres botar?",
    "¿Qué lugar de tu infancia ya no existe pero recuerdas?",
    "Si pudieras cambiarle el nombre a un mes del año ¿Cómo lo llamarías?",
    "Los aliens están a punto de destruir el mundo, dales una razón para que no lo hagan.",
    "Acabas de viajar en el tiempo y estás con los cavernícolas, ¿qué les puedes enseñar?",
    "Debes refugiarte 3 meses en el bosque, ¿qué alimentos enlatados llevas?"
  ];

  const box = $('#questionBox');
  const textEl = $('#questionText');
  const revealBtn = $('#revealBtn');
  const prevBtn = $('#prevBtn');
  const whoBtn = $('#whoBtn');
  const copyBtn = $('#copyBtn');
  const customEl = $('#custom');
  const studentsEl = $('#students');
  const timerEl = document.querySelector('[data-dc-timer]');

  let pool = [];
  let history = [];
  let pos = -1;
  let whoPool = [];

  const source = () => document.querySelector('input[name="source"]:checked').value;

  function questions() {
    const mine = parseList(customEl.value);
    if (source() === 'mias') return mine;
    if (source() === 'ambas') return [...BANCO, ...mine];
    return BANCO;
  }

  function refillPool() {
    pool = shuffle(questions());
  }

  function updateCounts() {
    const mine = parseList(customEl.value).length;
    $('#customCount').textContent = String(mine);
    $('#studentsCount').textContent = String(parseList(studentsEl.value).length);
    const total = questions().length;
    $('#progressLabel').textContent = history.length
      ? `Pregunta ${pos + 1} de ${history.length} vistas · ${total} en total`
      : `${total} preguntas disponibles`;
    prevBtn.disabled = pos <= 0;
    revealBtn.innerHTML = pos < history.length - 1
      ? '<i class="bi bi-arrow-right" aria-hidden="true"></i> Siguiente'
      : '<i class="bi bi-shuffle" aria-hidden="true"></i> Nueva pregunta';
  }

  function show(q, { animate = true } = {}) {
    $('#who').hidden = true;
    if (animate && !DC.reducedMotion()) {
      box.classList.remove('is-in');
      box.classList.add('is-out');
      setTimeout(() => {
        textEl.textContent = q;
        box.classList.remove('is-out');
        box.classList.add('is-in');
      }, 220);
    } else {
      textEl.textContent = q;
    }
    copyBtn.disabled = false;
    updateCounts();
  }

  function next() {
    if (pos < history.length - 1) {
      // Si veníamos de "Anterior", avanzamos por el historial
      pos += 1;
      show(history[pos]);
      return;
    }
    if (!questions().length) {
      textEl.textContent = 'Escribe tus preguntas en «Mis preguntas» o elige el banco de Dinamiclase.';
      return;
    }
    if (!pool.length) {
      refillPool();
      if (history.length) DC.toast({ title: '¡Ronda completa!', text: 'Ya salieron todas las preguntas. Empezamos de nuevo.', icon: 'bi-arrow-repeat', theme: 'cyan' });
    }
    const q = pool.pop();
    history.push(q);
    pos = history.length - 1;
    sfx('flip');
    show(q);
    if ($('#autoTimer').checked && timerEl?.dcTimer) timerEl.dcTimer.restart();
  }

  function prev() {
    if (pos <= 0) return;
    pos -= 1;
    sfx('click');
    show(history[pos]);
  }

  function pickWho() {
    const list = parseList(studentsEl.value);
    if (!list.length) {
      const details = studentsEl.closest('details');
      details.open = true;
      studentsEl.focus();
      DC.toast({ title: 'Falta la lista de estudiantes', text: 'Escríbela en «Estudiantes para ¿Quién responde?» (se comparte con otras herramientas).', icon: 'bi-people-fill', theme: 'blue' });
      return;
    }
    if (!whoPool.length) whoPool = shuffle(list);
    const name = whoPool.pop();
    $('#whoName').textContent = name;
    const who = $('#who');
    who.hidden = false;
    who.classList.remove('is-pop');
    void who.offsetWidth;
    who.classList.add('is-pop');
    sfx('pop');
  }

  revealBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);
  whoBtn.addEventListener('click', pickWho);
  copyBtn.addEventListener('click', () => copyText(textEl.textContent.trim()));
  customEl.addEventListener('input', () => { refillPool(); updateCounts(); });
  studentsEl.addEventListener('input', () => { whoPool = []; updateCounts(); });
  document.querySelectorAll('input[name="source"]').forEach((r) => r.addEventListener('change', () => { refillPool(); updateCounts(); }));

  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'q' || e.key === 'Q') pickWho();
  });

  refillPool();
  updateCounts();
})();
