const programElement = document.querySelector('#program');
const debugElement = document.querySelector('#debug');
let controller;
let program;
let task;
const programString = `/PROG TEST
/MN
1: R[1]=0 ;
2: LBL[1] ;
3: R[1]=R[1]+1 ;
4: IF R[1]<10,JMP LBL[1] ;
5:  ;
6: ! R[1]=10 now ;
7: L P[1:test] 100mm/sec CNT100 ;
/POS
P[1:"test"]{
	GP1:
	UF : 0, UT : 0, CONFIG : 'N U T, 0, 0, 0',
	X = 100.000 mm, Y = 100.000 mm, Z = 100.000 mm,
	W = 0.000 deg, P = 0.000 deg, R = 0.000 deg
};
/END`;

function override(object, methodName, callback) {
	object[methodName] = callback(object[methodName])
}

function after(extraBehavior) {
	return function(original) {
		return function() {
			var returnValue = original.apply(this, arguments)
			extraBehavior.apply(this, arguments)
			return returnValue
		}
	}
}

function before(extraBehavior) {
	return function(original) {
		return function() {
			extraBehavior.apply(this, arguments)
			return original.apply(this, arguments)
		}
	}
}

function timeStamp() {
	const now = new Date();
	return `${now.toLocaleDateString('nb-NO')} ${now.toLocaleTimeString('nb-NO')}`;
}

function debug(s) {
	debugElement.innerHTML = `${timeStamp()}  ${s}\n` + debugElement.innerHTML;
}

function updateNumreg(id, value) {
	document.querySelector(`#numreg_${id}`).innerText = value;
}

function setLine(number) {
	const lines = programElement.querySelectorAll('li');
	[...lines].forEach((line) => line.classList.remove('current'));
	programElement.querySelector(`li:nth-child(${number + 2})`).classList.add('current');
}

function init(programString) {
	if (program || task) {
		task.reset();
		debugElement.innerHTML = '';
		programElement.innerHTML = '';
	}

	programString.split('\n').forEach((line) => {
		programElement.innerHTML += `<li><pre>${line}</pre></li>`;
	});

	controller = new tp.Runtime();
	program = tp.Program.fromString(programString);
	task = new tp.Task(controller, program);

	// Monkey patching...
	override(controller, 'set_numreg', after((id, value) => {
		debug(`setting R[${id}] to ${value}`);
		updateNumreg(id, value);
	}));

	override(controller, 'move_to', before((motion_type, destination, speed, termination, modifiers) => {
		debug(`moving to (${destination.x}, ${destination.y}, ${destination.z}, ${destination.w}, ${destination.p}, ${destination.r})`);
	}));

	override(task, 'step', before(() => {
		debug(`executing line: ${task.line_number + 1}`);
	}));

	override(task, 'next_line', after(() => {
		debug(`line number is now: ${task.line_number + 1}`);
		setLine(task.line_number + 1);
	}));

	override(task, 'run', after(() => {
		debug('end of program');
	}));

	override(task, 'jump_to_label', before((id) => {
		debug(`jumping to LBL[${id}]`);
	}));

	override(task, 'jump_to', after((id) => {
		debug(`line number is now: ${task.line_number + 1}`);
		setLine(task.line_number + 1);
	}));

	override(task, 'reset', after(() => {
		setLine(1);
	}));

	override(task, 'report_error', after((e) => {
		debug(`error: ${e.message}`);
	}));
}

document.querySelector('input[type=file]').addEventListener('change', () => {
	const [file] = document.querySelector('input[type=file]').files;
	const reader = new FileReader();

	reader.addEventListener('load', (e) => {
		init(e.target.result);
	}, false);

	if (file) {
		reader.readAsText(file)
	}
});

document.querySelector('#reset').addEventListener('click', () => {
	task.reset();
	debugElement.innerHTML = '';
});

document.querySelector('#run').addEventListener('click', () => {
	try {
		task.run();
	}
	catch (e) {
		debug(e.message);
	}
});

document.querySelector('#step').addEventListener('click', () => {
	if (!task.step()) {
		task.reset();
	}
});

document.querySelector('#pause').addEventListener('click', () => {
	task.stop();
});

document.querySelector('#toggle-theme').addEventListener('click', () => {
	document.documentElement.dataset.theme = document.documentElement.dataset.theme == 'light' ? 'dark' : 'light';
});

const colorSchemeQueryList = window.matchMedia('(prefers-color-scheme: dark)');
const setColorScheme = e => {
	if (e.matches) {
		document.documentElement.dataset.theme = 'dark';
	} else {
		document.documentElement.dataset.theme = 'light';
	}
}

setColorScheme(colorSchemeQueryList);
colorSchemeQueryList.addEventListener('change', setColorScheme);

init(programString);
