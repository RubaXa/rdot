ReactiveDot
-----------
Всё это написано с целью моего самообучения и детального знакомства с реактивным программированием и TS.


### Пример проложения

 - TodoMVC — [online](//rubaxa.gitgub.io/rdot/demo/todomvc/) / [source](./demo/todomvc/)
 

### Установка

`npm install rdot`


### Пример использования

```js
// Пример: a + b
const a = rdot(1); // создаем реактивную точку/контейнер/переменную (на самом делел простою функцию)
const b = rdot(2);
const sum = rdot(() => a + b); // реактивное выражение, зависящее от двух реактивных переменных

// (1) Вычисляем результат
console.log(sum()); // 3

// (2) Подписываемся на изменение суммы
sum.onValue(result => console.log(`sum: ${result}`)); // "sum: 3"

// Изменяем `a`
a.set(3); // "sum: 5" — т.е. сработает callback на `sum`,
b.set(-3); // "sum: 0" — да, схлопывания нет, оно не было целью
```


### Как это можно использовать?

#### «Подсчет кликов»
```html
<form name="counter">
	<button name="up" type="button">+</button>
	<button name="down" type="button">-</button>
	<input name="result" readonly/>
</form>
```

```js
(function () {
	// Счетчик + сеттер, который при получении нового значения, прибовляет к нему старое
	const counter = rdot(0, (newValue, oldValue) => newValue + (oldValue||0));

	// Создаем «рективный поток» на основе события `click`:
	rdot.fromEvent(form.up, 'click').onValue(() => counter.set(+1));
	rdot.fromEvent(form.down, 'click').onValue(() => counter.set(-1));

	// Ещё один поток, который будет изменять свойство `value`:
	counter.assign(form.result, 'value');

	// Эквивалентно записи:
	counter.onValue(num => {
		form.result.value = num);
	});
})(document.forms.counter);
```


#### «Валидация формы»

```html
<form name="reg">
	<div>
		<input placeholder="Username" name="username"/>
		<span></span>
	</div>
	<div>
		<input placeholder="Fullname" name="fullname"/>
		<span></span>
	</div>
	<button name="reg">Reg</button>
</form>
```

```js
(function (form) {
	// Создаем реактивную двухстороннюю связку с Input-элементом
	const username = rdot.dom(form.username);
	const fullname = rdot.dom(form.fullname);

	// Реактивное правило валидации
	const validate = rdot(() => username().length > 0 && fullname().length > 0);

	// Связываем кол-во введенных символов и их вывод в соответствующем DOM-элементе
	[username, fullname].forEach(dot => {
		dot
			.map(value => value.length)
			.assign(dot.el.nextElementSibling);
	});

	// Связываем правило валидации с состоянием кнопки
	validate.not().assign(form.reg, 'disabled');
})(document.forms.reg);
```


### Что дальше?

А дальше, гроб, гроб, кладбище... MIT.




const list = new rdot.List('A', 'B', 'C');

list.push('D');   // + idx: 4
list.remove('A'); // - idx: 1
list.push('E');   // + idx: 4
list.remove('D'); // - idx: 3

---1---
<ul>
	<li>A</li>
	<li>B</li>
	<li>C</li>
	[li]D[/li]
</ul>

---2---
<ul>
-	<li>A</li>
	<li>B</li>
	<li>C</li>
+	[li]D[/li]
</ul>

---3---
<ul>
-	<li>A</li>
	<li>B</li>
	<li>C</li>
+	[li]D[/li]
+	[li]E[/li]
</ul>


---4---
<ul>
-	<li>A</li>
	<li>B</li>
	<li>C</li>
+	[li]E[/li]
</ul>


---FINAL---
<ul>
	<li>B</li>
	<li>C</li>
+	<li>E</li>   (based on <li>A</li>)
</ul>


---

<ul>
	<li>B</li>
	<li>C</li>
	<li>E</li>
</ul>
