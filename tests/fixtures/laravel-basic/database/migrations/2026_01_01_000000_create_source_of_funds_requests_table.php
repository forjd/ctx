<?php

return new class {
    public function up(): void
    {
        Schema::create('source_of_funds_requests', function ($table): void {
            $table->timestamp('expires_at')->nullable();
        });
    }
};
