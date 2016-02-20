(function (window) {
	'use strict';

	const KEY_ENTER = 13;
	const FILTER_ALL = '/';
	const FILTER_ACTIVE = '/active';
	const FILTER_COMPLETED = '/completed';

	const newTodoEl = document.querySelector('.new-todo');
	const listEl = document.querySelector('.todo-list');
	const footerEl = document.querySelector('.footer');
	const filtersEl = footerEl.querySelectorAll('.filters a');
	const todoCountEl = footerEl.querySelector('.todo-count');
	const clearCompletedEl = footerEl.querySelector('.clear-completed');

	const location = rdot.fromEvent(window, 'hashchange').map(value => window.location.href.split('#')[1] || FILTER_ALL);
	const newTodo = rdot.dom(newTodoEl);
	const todosStorage = new rdot.Model.List();
	const stats = new rdot.Model({
		left: 0,
		completed: 0
	});


	// Слушаем событие инпута
	rdot.fromEvent(newTodo.el, 'keydown').onValue(evt => {
		if (evt.keyCode === KEY_ENTER) {
			todosStorage.unshift(new rdot.Model({
				value: newTodo(),
				completed: false
			}));

			newTodo.set(''); // clear
		}
	});

	// Видимость подвала
	const footerVisiblity = todosStorage.map(todos => todos.length > 0);


	footerVisiblity
		.map(state => state ? '' : 'none')
		.assign(footerEl.style, 'display');

	// Выбранный фильтр
	location
		.filter(filter => footerVisiblity())
		.onValue(filter => {
			[].forEach.call(filtersEl, a => {
				a.className = a.href.split('#')[1] === filter ? 'selected' : '';
			});
		});

	// Подсчет статистики
	todosStorage.fetch(todos => {
		let left = 0;
		let completed = 0;

		todos.forEach(todo => {
			left += !todo.completed();
			completed += todo.completed();
		});

		stats.left.set(left);
		stats.completed.set(completed);
	});

	// Осталось дел
	stats.left
		.map(cnt => `${cnt} ${cnt === 1 ? 'item' : 'items'}`)
		.assign(todoCountEl);

	// Выполненых дел
	stats.completed
		.map(cnt => cnt ? '' : 'none')
		.assign(clearCompletedEl.style, 'display');

	// Обновление списка
	rdot.combine([location, todosStorage])
		.arrayFilter(([filter, todos]) => ({
			array: todos,
			callback(todo) {
				return (
					(FILTER_ALL === filter) ||
					(FILTER_ACTIVE === filter && !todo.completed()) ||
					(FILTER_COMPLETED === filter && todo.completed())
				);
			}
		}))
		.onValue(renderTodosList)
	;


	function renderTodosList(todos) {
		console.info('renderTodosList:', todos.length);
		console.time('renderTodosList');

		todos.forEach((todo, idx) => {
			const el = listEl.children[idx] || document.createElement('li');

			if (el.todo !== todo) {
				el.todo = todo;
				el.rdot = el.rdot || rdot();
				el.onchange = () => {
					todo.completed.set(!todo.completed());
				};
			}

			el.rdot.set(() => {
				el.className = todo.completed() ? 'completed' : '';
				el.innerHTML = `<div class="view">
					<input ${todo.completed() ? 'checked' : ''} class="toggle" type="checkbox"/>
					<label>${todo.value()}</label>
					<button class="destroy"></button>
				</div>`;
			});
			el.rdot();

			el.onclick = (evt) => {
				if (evt.target.classList.contains('destroy')) {
					todosStorage.remove(todo);
				}
			};

			if (!el.parentNode) {
				listEl.appendChild(el);
			}
		});

		for (let i = listEl.children.length; i > todos.length; i--) {
			listEl.removeChild(listEl.children[i-1]);
		}

		console.timeEnd('renderTodosList');
	}

	console.time('push');
	for (let i = 0; i < 1e1; i++) {
		todosStorage.push(new rdot.Model({
			value: 'foo #' + (i+1),
			completed: false
		}));
	}
	console.timeEnd('push');

	// Export
	window.todosStorage = todosStorage;
})(window);
