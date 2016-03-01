import Task from './task';
import {STORE_NAME} from './const';

export function getHash() {
	return location.toString().split('#/')[1];
}

export function loadTodos() {
	return JSON.parse(localStorage.getItem(STORE_NAME)) || [];
}

export function saveTodos(todos) {
	JSON.stringify(STORE_NAME, todos);
}

export function filterByHash(dot) {
	return dot.arrayFilter(([filter, todos]) => {
		return {
			array: todos,
			callback: (todo:Task) => (
				('all' === filter) ||
				('active' === filter && !todo.completed) ||
				('completed' === filter && todo.completed)
			)
		};
	});
}

export function filterByCompleted(dot) {
	return dot.arrayFilter(([todos]) => ({
		array: todos,
		callback: (todo:Task) => !todo.completed
	}))
}

export function isAllCompleted(dot) {
	return dot.map(([filteredTodos]) => filteredTodos.length && filteredTodos.every(todo => todo.completed));
}
