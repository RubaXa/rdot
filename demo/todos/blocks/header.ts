import {RStream} from '../../../src/rdot';
import {reactive} from '../../../src/rdecorators';


export default class Header {
	static template:string = `<header id="header">
		<h1>todos</h1>
		
		<form id="todo-form" on-submit="{this.handleSubmit(evt)}">
			<input
				id="new-todo"
				autocomplete="off"
				placeholder="What needs to be done?" autofocus
				value="{this.text}"
			/>
		</form>
	</header>`;

	@reactive public text:string = '';
	@reactive public onadd:RStream<string>;

	handleSubmit(evt:Event) {
		const text:string = this.text.trim();

		if (text) {
			this.onadd.add(text);
			this.text = '';
		}

		evt.preventDefault();
	}
}
