import {
    Component,
    Input,
    Output,
    EventEmitter,
    TemplateRef,
    ElementRef,
    HostListener,
    HostBinding,
    ViewChild,
    ChangeDetectorRef,
    Renderer2
} from '@angular/core';

import { TagModel } from '../../core';
import { TagRipple } from '../tag';

// angular universal hacks
/* tslint:disable-next-line */
const KeyboardEvent = (global as any).KeyboardEvent;
const MouseEvent = (global as any).MouseEvent;

// mocking navigator
const navigator = typeof window !== 'undefined' ? window.navigator : {
    userAgent: 'Chrome',
    vendor: 'Google Inc'
};

const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

@Component({
    selector: 'tag',
    template: `
      <div (click)="select($event)"
           (dblclick)="toggleEditMode()"
           (mousedown)="rippleState='clicked'"
           (mouseup)="rippleState='none'"
           [ngSwitch]="!!template"
           [class.disabled]="disabled"
           [attr.tabindex]="-1"
           [attr.aria-label]="getDisplayValue(model)">

        <div *ngSwitchCase="true" [attr.contenteditable]="editing">
          <!-- CUSTOM TEMPLATE -->
          <ng-template
            [ngOutletContext]="{ item: model, index: index }"
            [ngTemplateOutletContext]="template">
          </ng-template>
        </div>

        <div *ngSwitchCase="false" class="tag-wrapper">
          <!-- TAG NAME -->
          <div [attr.contenteditable]="editing"
               [attr.title]="getDisplayValue(model)"
               class="tag__text inline"
               spellcheck="false"
               (keydown.enter)="disableEditMode($event)"
               (keydown.escape)="disableEditMode($event)"
               (click)="editing ? $event.stopPropagation() : undefined"
               (blur)="onBlurred($event)">
            {{ getDisplayValue(model) }}
          </div>

          <!-- 'X' BUTTON -->
          <delete-icon
            aria-label="Remove tag"
            role="button"
            (click)="remove($event)"
            *ngIf="isDeleteIconVisible()">
          </delete-icon>
        </div>
      </div>

      <tag-ripple [state]="rippleState"
                  [attr.tabindex]="-1"
                  *ngIf="isRippleVisible">
      </tag-ripple>
    `
})
export class TagComponent {
    /**
     * @name model {TagModel}
     */
    @Input() public model: TagModel;

    /**
     * @name removable {boolean}
     */
    @Input() public removable: boolean;

    /**
     * @name editable {boolean}
     */
    @Input() public editable: boolean;

    /**
     * @name template {TemplateRef<any>}
     */
    @Input() public template: TemplateRef<any>;

    /**
     * @name displayBy {string}
     */
    @Input() public displayBy: string;

    /**
     * @name identifyBy {string}
     */
    @Input() public identifyBy: string;

    /**
     * @name index {number}
     */
    @Input() public index: number;

    /**
     * @name hasRipple
     */
    @Input() public hasRipple: boolean;

    /**
     * @name disabled
     */
    @Input() public disabled = false;

    /**
     * @name onSelect
     * @type {EventEmitter<TagModel>}
     */
    @Output() public onSelect: EventEmitter<TagModel> = new EventEmitter<TagModel>();

    /**
     * @name onRemove
     * @type {EventEmitter<TagModel>}
     */
    @Output() public onRemove: EventEmitter<TagModel> = new EventEmitter<TagModel>();

    /**
     * @name onBlur
     * @type {EventEmitter<TagModel>}
     */
    @Output() public onBlur: EventEmitter<TagModel> = new EventEmitter<TagModel>();

    /**
     * @name onKeyDown
     * @type {EventEmitter<any>}
     */
    @Output() public onKeyDown: EventEmitter<any> = new EventEmitter<any>();

    /**
     * @name onTagEdited
     * @type {EventEmitter<any>}
     */
    @Output() public onTagEdited: EventEmitter<TagModel> = new EventEmitter<TagModel>();

    /**
     * @name readonly {boolean}
     */
    public get readonly(): boolean {
        return typeof this.model !== 'string' && this.model.readonly === true;
    };

    /**
     * @name editing
     * @type {boolean}
     */
    public editing = false;

    /**
     * @name moving
     * @type {boolean}
     */
    @HostBinding('class.moving') public moving: boolean;

    /**
     * @name rippleState
     * @type {string}
     */
    public rippleState = 'none';

    /**
     * @name ripple {TagRipple}
     */
    @ViewChild(TagRipple) public ripple: TagRipple;

    constructor(public element: ElementRef,
                public renderer: Renderer2,
                private cdRef: ChangeDetectorRef) {}

    /**
     * @name select
     */
    public select($event?: MouseEvent): void {
        if (this.readonly || this.disabled) {
            return;
        }

        if ($event) {
            $event.stopPropagation();
        }

        this.focus();

        this.onSelect.emit(this.model);
    }

    /**
     * @name remove
     */
    public remove($event: MouseEvent): void {
        $event.stopPropagation();
        this.onRemove.emit(this);
    }

    /**
     * @name focus
     */
    public focus(): void {
        this.element.nativeElement.focus();
    }

    public move(): void {
        this.moving = true;
    }

    /**
     * @name keydown
     * @param event
     */
    @HostListener('keydown', ['$event'])
    public keydown(event: KeyboardEvent): void {
        if (this.editing) {
            event.keyCode === 13 ? this.disableEditMode(event) : undefined;
            return;
        }

        this.onKeyDown.emit({event, model: this.model});
    }

    /**
     * @name blink
     */
    public blink(): void {
        const classList = this.element.nativeElement.classList;
        classList.add('blink');

        setTimeout(() => classList.remove('blink'), 50);
    }

    /**
     * @name toggleEditMode
     */
    public toggleEditMode(): void {
        if (this.editable) {
            this.editing ? undefined : this.activateEditMode();
        }
    }

    /**
     * @name onBlurred
     * @param event
     */
    public onBlurred(event: any): void {
        // Checks if it is editable first before handeling the onBlurred event in order to prevent
        // a bug in IE where tags are still editable with onlyFromAutocomplete set to true
		if (!this.editable) {
			return;
		}

        const value: string = event.target.innerText;
        const result = typeof this.model === 'string' ? value :
            {[this.identifyBy]: value, [this.displayBy]: value};

        this.disableEditMode();

        this.onBlur.emit(result);
    }

    /**
     * @name getDisplayValue
     * @param item
     * @returns {string}
     */
    public getDisplayValue(item: TagModel): string {
        return typeof item === 'string' ? item : item[this.displayBy];
    }

    /**
     * @desc returns whether the ripple is visible or not
     * only works in Chrome
     * @name isRippleVisible
     * @returns {boolean}
     */
    public get isRippleVisible(): boolean {
        return !this.readonly &&
            !this.editing &&
            isChrome &&
            this.hasRipple;
    }

    /**
     * @name getContentEditableText
     * @returns {string}
     */
    private getContentEditableText(): string {
        const input = this.getContentEditable();

        return input ? input.innerText.trim() : '';
    }

    /**
     * @name setContentEditableText
     * @param model
     */
    private setContentEditableText(model: TagModel) {
        const input = this.getContentEditable();
        const value = this.getDisplayValue(model);

        input.innerText = value;
    }

    /**
     * @name
     */
    private activateEditMode(): void {
        const classList = this.element.nativeElement.classList;
        classList.add('tag--editing');

        this.editing = true;
    }

    /**
     * @name disableEditMode
     * @param $event
     */
    private disableEditMode($event?: KeyboardEvent): void {
        const classList = this.element.nativeElement.classList;
        const input = this.getContentEditableText();

        this.editing = false;
        classList.remove('tag--editing');

        if (!input) {
            this.setContentEditableText(this.model);
            return;
        }

        this.storeNewValue(input);
        this.cdRef.detectChanges();

        if ($event) {
            $event.preventDefault();
        }
    }

    /**
     * @name storeNewValue
     * @param input
     */
    private storeNewValue(input: string): void {
        const exists = (model: TagModel) => {
            return typeof model === 'string' ?
                model === input :
                model[this.displayBy] === input;
        };

        // if the value changed, replace the value in the model
        if (exists(this.model) === false) {
            const model = typeof this.model === 'string' ? input :
                {[this.identifyBy]: input, [this.displayBy]: input};

            // emit output
            this.model = model;
            this.onTagEdited.emit(model);
        }
    }

    /**
     * @name getContentEditable
     */
    private getContentEditable(): HTMLInputElement {
        return this.element.nativeElement.querySelector('[contenteditable]');
    }

    /**
     * @name isDeleteIconVisible
     * @returns {boolean}
     */
    private isDeleteIconVisible(): boolean {
        return !this.readonly &&
                !this.disabled &&
                this.removable &&
                !this.editing;
    }
}
