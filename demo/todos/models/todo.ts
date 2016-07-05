import {reactive} from '../../../src/rdecorators';

export default class Todo {
	@reactive public text:string;
	@reactive public completed:boolean;

	constructor(text:string, completed:boolean = false) {
		this.text = text;
		this.completed = completed;
	}
}
