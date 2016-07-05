import Link from './link';

export default class FooterInfo {
	static template:string = `<footer id="info">
		<p>Double-click to edit a todo</p>
		<p>Part of <link to="http://todomvc.com" text="TodoMVC"/></p>
	</footer>`;

	static blocks = {
		'link': Link
	}
}
